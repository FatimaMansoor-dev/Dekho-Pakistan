from flask import Flask, render_template, request, jsonify
import google.generativeai as genai
import dataset
import subprocess
from llama_index.llms.gemini import Gemini  # Import Gemini for text models
from llama_index.core import StorageContext, Document
import os
# from fpdf import FPDF
from fpdf import FPDF, HTMLMixin
from dotenv import load_dotenv
from email.mime.base import MIMEBase
from email import encoders
# import markdown
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from xhtml2pdf import pisa

app = Flask(__name__)

# Configure the Gemini API
api = os.getenv('API_KEY')
genai.configure(api_key=api)
model = genai.GenerativeModel('models/gemini-pro-vision') 

# Email configuration
SMTP_SERVER = 'smtp.gmail.com'
SMTP_PORT = 587
GMAIL_USERNAME = os.getenv('GMAIL_USERNAME')
GMAIL_PASSWORD = os.getenv('GMAIL_PASSWORD')

def search_gemini(quest):
    prompt = f''' You are an expert travel agent of pakistan. You know every little detail about Pakistana nd its regions.
    You are talking to a client who is interested in visiting pakistan. Provide convincing answer to
    this question in not more han 100 words :
        {quest} providing reference to places in pakistan.
        '''
    response = genai.generate_text(prompt=prompt)
    search_res = response.result.strip().split("\n")
    print(search_res)
    return search_res

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/search', methods=['POST'])
def search_hotels():
    data = request.json
    city = data.get('city')
    rating = data.get('ratings')
    hotel_names = get_hotel_details(city, rating)
    return jsonify({'hotel_names': hotel_names})

@app.route('/gemini_search', methods=['POST'])
def gemini_search():
    data = request.json
    question = data.get('question')
    answer = search_gemini(question)
    return jsonify({'answer': answer})

def get_hotel_details(city, rating):
    df = dataset.hotel_data()
    df = df[df['hotelcity'].str.lower() == city.lower()]
    df = df[df['hotelrating'] == float(rating)]
    hotel_names_urls = df[['hotelname', 'hotelimg', 'hotelreview']].values.tolist()
    return [{'name': name, 'img': img, 'review':review} for name, img, review in hotel_names_urls]

@app.route('/execute_voicebot', methods=['POST'])
def execute_voicebot():
    # Execute the Python script
    subprocess.call(['python', 'voicebot.py'])
    return 'Voicebot executed successfully'


@app.route('/execute_generateplan', methods=['POST'])
def tourplan():
    data = request.get_json()
    people = data.get('people')
    interests = data.get('interests')
    budget = data.get('budget')
    days = data.get('days')

    # Load environment variables from .env file
    load_dotenv()
    api_key = os.getenv('API_KEY')
    if api_key is None:
        exit('You must provide an API_KEY env var.')

    # Define the Gemini class for embeddings and querying
    class GeminiEmbedding:
        def __init__(self, api_key):
            self.api_key = api_key
            self.gemini = Gemini(model="models/gemini-1.5-flash", api_key=api_key)
        
        def query(self, query_text, documents):
            prompt = f'''You are a travel agent of Pakistan and your job is to generate a day-to-day travel plan that is within the total budget of user. 
            total budget is provided in the question along with area of interest and no of people. First compare the budget, If the tour is not possible within that total budget for given no of
            people, just say you donot have enough budget, but if budget>estimated price from document, generate a custom travel plan that is of provided days and do tell in the end what the package includes. Donot ask any questions from user, Donot talk about any provided document,donot use * before **  :\n\nQuestion: {query_text}\n\nDocuments:\n'''
            for doc in documents:
                prompt += f"{doc.text}\n\n"  # Assuming Document class has a 'text' attribute
            
            response = self.gemini.complete(prompt)
            return response

    # Initialize GeminiEmbedding with your API key
    gemini_embedding = GeminiEmbedding(api_key)

    # Function to load documents
    def load_documents(file_path):
        with open(file_path, 'r') as file:
            content = file.read().split('\n\n')  # Split by double newlines for sections
        return [Document(text=section) for section in content]  # Use Document class

    # Main workflow
    file_path = "data/data.txt"
    documents = load_documents(file_path)

    # Initialize the StorageContext and add documents
    storage_context = StorageContext.from_defaults()
    storage_context.docstore.add_documents(documents)

    # Persist the storage context to a directory
    PERSIST_DIR = './my_vector_indexes/gutenberg/'
    storage_context.persist(persist_dir=PERSIST_DIR)

    # Querying
    query_text = f"make a travel plan for {days} days in {budget} pkr, focusing on {', '.join(interests)} for {people} people"
    response = gemini_embedding.query(query_text, documents)
    print(response)
    # Convert Markdown to HTML
    response_text = str(response)
    
    # Return the HTML as a JSON object
    return jsonify({"answer": response_text})

    # return (response)


def create_pdf(html_content):
    pdf_output = 'tour_plan.pdf'
    heading = """
    <div style="color: orange; font-size: 24px; font-weight: bold; text-align: center; margin-bottom: 30px;">
        Dekho Pakistan
    </div>
    """
    ending = """
        <div style="color: orange; font-size: 24px; font-weight: bold; text-align: center; margin-bottom: 30px;">
        Happy Travelling :)
    </div>
    """
    complete_html_content = heading + html_content + ending
    with open(pdf_output, "w+b") as result_file:
        pisa_status = pisa.CreatePDF(complete_html_content, dest=result_file)
    if pisa_status.err:
        return None
    return pdf_output

@app.route('/send_email', methods=['POST'])
def send_email():
    data = request.get_json()
    email = data['email']
    formatted_text = data['formatted_text']
    
    # Create the PDF
    pdf_path = create_pdf(formatted_text)
    if not pdf_path:
        return jsonify({'message': 'Failed to create PDF'}), 500
    
    # Create the email
    msg = MIMEMultipart()
    msg['From'] = GMAIL_USERNAME
    msg['To'] = email
    msg['Subject'] = 'Your Tour Plan'
    
    # Email body
    body = 'Here is your tour plan in PDF format.'
    msg.attach(MIMEText(body, 'plain'))
    
    # Attach the PDF
    with open(pdf_path, 'rb') as attachment:
        part = MIMEBase('application', 'octet-stream')
        part.set_payload(attachment.read())
        encoders.encode_base64(part)
        part.add_header('Content-Disposition', f'attachment; filename={os.path.basename(pdf_path)}')
        msg.attach(part)
    
    # Send the email
    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(GMAIL_USERNAME, GMAIL_PASSWORD)
        text = msg.as_string()
        server.sendmail(GMAIL_USERNAME, email, text)
        server.quit()
        print("done")
        return jsonify({'message': 'Email Sent Successfully! :)'})
    except Exception as e:
        print(f'Failed to send email: {e}')
        return jsonify({'message': 'Error Sending Email'}), 500
if __name__ == '__main__':
    app.run()

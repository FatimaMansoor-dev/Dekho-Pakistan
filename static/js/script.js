document.addEventListener('DOMContentLoaded', () => {
    let searchbtn = document.querySelector('#search-btn');
    let searchbar = document.querySelector('.search-bar-container');
    let menu = document.querySelector('#menu-bar');
    let navbar = document.querySelector('.navbar');
    let vidBtn = document.querySelectorAll('.vid-btn');

    let searchBarInput = document.querySelector('#search-bar');
    let msgBox = document.createElement('div');
    let msgBoxText = document.createElement('p');
    let closeMsgBtn = document.createElement('button');

    // Create message box
    msgBox.id = 'msg-box';
    msgBox.classList.add('hidden');
    closeMsgBtn.id = 'close-msg-btn';
    closeMsgBtn.innerText = 'Close';
    msgBox.appendChild(msgBoxText);
    msgBox.appendChild(closeMsgBtn);
    document.body.appendChild(msgBox);

    // CSS styles for the message box
    const style = document.createElement('style');
    style.innerHTML = `
        #msg-box {
            position: fixed;
            top: 20%;
            left: 50%;
            transform: translate(-50%, -50%);
            padding: 20px;
            background-color: white;
            border: 1px solid #ccc;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            z-index: 1000;
        }
        #msg-box.hidden {
            display: none;
        }
        #close-msg-btn {
            margin-top: 10px;
        }
    `;
    document.head.appendChild(style);

    window.onscroll = () => {
        searchbtn.classList.remove('fa-times');
        searchbar.classList.remove('active');
        menu.classList.remove('fa-times');
        navbar.classList.remove('active');
    };

    searchbtn.addEventListener('click', () => {
        searchbtn.classList.toggle('fa-times');
        searchbar.classList.toggle('active');
        let searchLabel = document.querySelector('#search-label');
        searchLabel.addEventListener('click', (event) => {
            event.preventDefault(); // Prevent the default form submission
            if (searchbar.classList.contains('active')) {
                const searchValue = searchBarInput.value;
                console.log('Search value:', searchValue);

                // Send the search value to the Flask backend
                fetch('/gemini_search', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ question: searchValue })
                })
                .then(response => response.json())
                .then(data => {
                    // Ensure data.answer is defined and convert to string
                    let answer = data.answer ? String(data.answer) : '';

                    // Handle the response from the Flask backend
                    console.log('Response from Gemini API:', answer);

                    // Format the answer to replace ** with <strong> tags
                    let formattedText = answer.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

                    // Display the formatted answer in the message box
                    msgBoxText.innerHTML = formattedText;
                    msgBox.classList.remove('hidden');
                })
                .catch(error => {
                    console.error('Error:', error);
                });
            }
        });
    });

    closeMsgBtn.addEventListener('click', () => {
        msgBox.classList.add('hidden');
    });

    menu.addEventListener('click', () => {
        menu.classList.toggle('fa-times');
        navbar.classList.toggle('active');
    });

    vidBtn.forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelector('.controls .active').classList.remove('active');
            btn.classList.add('active');

            // Update the video source
            let src = btn.getAttribute('data-src');
            document.querySelector('#video-slider').src = src;
        });
    });

    $(document).ready(function() {
        $('#bookingForm').submit(function(event) {
            // Prevent the default form submission behavior
            event.preventDefault();

            // Get the values of city and ratings inputs
            const city = $('#cityInput').val();
            const ratings = $('#ratingsInput').val();

            // Check if city input or ratings input is empty
            if (!city || !ratings) {
                // Display alert message if inputs are empty
                alert('Null entries are not allowed. Please fill in all fields.');
            } else {
                // Make an AJAX request to the Flask backend
                $.ajax({
                    type: 'POST',
                    url: '/search',
                    contentType: 'application/json',
                    data: JSON.stringify({ city: city, ratings: ratings }),
                    success: function(response) {
                        console.log('Response from server:', response);

                        // Assuming the response is an array of hotel names, URLs, and images
                        let hotelDetailsHtml = response.hotel_names.map(hotel => `
                            <div>
                                <h4>${hotel.name}</h4>
                                <p><a href="${hotel.img}" target="_blank"><img class="hotel-img" src="${hotel.img}" alt="${hotel.name}" /></a></p>
                            </div>`).join('');

                        let rev = response.hotel_names.map(hotel => `
                            <div>
                                <p>${hotel.review}</p>
                            </div>`).join('<div class="review-space"></div>'); // Add a div for spacing between reviews

                        // Update the content of the span element with the hotel names, URLs, and images HTML
                        $('#hoteldetails').html(hotelDetailsHtml);
                        $('#rev').html(rev);
                    }
                });
            }
        });
    });


    // document.getElementById('microphone-btn').addEventListener('click', function() {
    //     // Make an AJAX request to execute the Python script
    //     $.ajax({
    //         url: '/execute_voicebot', // This should be the URL of a server route that executes the Python script
    //         method: 'POST',
    //         success: function(response) {
    //             // Handle the response if needed
    //             console.log(response);
    //         },
    //         error: function(xhr, status, error) {
    //             // Handle errors
    //             console.error(error);
    //         }
    //     });
    // });
    document.getElementById('planNowBtn').addEventListener('click', async function(event) {
        event.preventDefault();
    
        const peopleInput = document.getElementById('peopleInput').value;
        const interests = Array.from(document.querySelectorAll('#interestsInput input:checked')).map(checkbox => checkbox.value);
        const budgetInput = document.getElementById('budgetInput').value;
        const daysInput = document.getElementById('daysInput').value;
    
        if (!peopleInput || !interests.length || !budgetInput || !daysInput) {
            alert("Please fill all fields");
            return;
        }
    
        const requestData = {
            people: peopleInput,
            interests: interests,
            budget: budgetInput,
            days: daysInput
        };
    
        try {
            const response = await fetch('/execute_generateplan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });
    
            if (response.ok) {
                const data = await response.json();
                console.log(data.answer);

                // Format the answer to replace ** with <span> tags with bold-orange class
                let formattedText = data.answer
                        .replace(/\*\*(.*?)\*\*/g, '<br>&nbsp;&nbsp;&nbsp;<span class="bold-orange">$1<br></span>')
                        .replace(/\*/g, '<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;*');

                document.getElementById('tourPlanResponse').innerHTML = `<div class="formatted-text">${formattedText}</div>`;
                document.getElementById('generatedTourPlan').classList.remove('hidden');
                document.getElementById('marqueeMessage').style.display = 'block';
                document.getElementById('emailForm').style.display = 'block'; 
            } else {
                console.error('Failed to generate tour plan');
            }
        } catch (error) {
            console.error('Error:', error);
        }
    });

    document.getElementById('emailForm').addEventListener('submit', function(event) {
        event.preventDefault(); // Prevent the default form submission
    
        const email = document.getElementById('email').value;
        const formattedText = document.querySelector('#tourPlanResponse .formatted-text').innerHTML;
    
        fetch('/send_email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email: email, formatted_text: formattedText })
        })
        .then(response => response.json())
        .then(data => {
            alert(data.message); // Show success or error message
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error Sending Email');
        });
    });
});

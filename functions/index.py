import os
import sys
from app import app as flask_app
from flask import Response

def handler(event, context):
    def wsgi_app(environ, start_response):
        return flask_app(environ, start_response)

    response = Response(wsgi_app(event["body"], lambda status, headers: None))

    return {
        "statusCode": response.status_code,
        "headers": dict(response.headers),
        "body": response.data.decode("utf-8")
    }

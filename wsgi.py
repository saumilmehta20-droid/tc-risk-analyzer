import os
import sys

os.environ['PA_WSGI'] = '1'

path = os.path.dirname(os.path.abspath(__file__))
if path not in sys.path:
    sys.path.insert(0, path)

from server import app as application

if __name__ == '__main__':
    application.run()

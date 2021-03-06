import SocketServer
import StringIO
import BaseHTTPServer
import time
import httplib
from urllib import urlencode
from urlparse import urlsplit

def fetch(url, params = None, contentType = "application/x-www-form-urlencoded"):
    pieces = urlsplit(url)
    conn = httplib.HTTPConnection(pieces[1])
    if params:
        conn.request("POST", pieces[2],
                     body = params,
                     headers = {"Content-type": contentType})
    else:
        conn.request("GET", pieces[2])
    return conn.getresponse()

class ReverseHttpServer(SocketServer.BaseServer):
    def __init__(self, label, server_address, RequestHandlerClass):
        SocketServer.BaseServer.__init__(self, server_address, RequestHandlerClass)
        self.label = label
        self.nextReq = None
        self.location = None
        self.failureDelay = 2
        self.token = "-"
        self.leaseSeconds = 30
        self.reportPollExceptions = False
        self.locationChangeCallback = None

    def get_request(self):
        while 1:
            try:
                declareMode = (self.nextReq == None)
                if declareMode:
                    resp = fetch(self.server_address,
                                 urlencode({"name": self.label, "token": self.token}))
                else:
                    resp = fetch(self.nextReq)
                if resp.status >= 200 and resp.status < 300:
                    self.failureDelay = 2
                    if declareMode:
                        linkHeaders = parseLinkHeaders(resp)
                        self.nextReq = linkHeaders["first"]
                        locationText = linkHeaders["related"]
                        if locationText:
                            self.location = locationText
                            self.on_location_changed()
                        continue
                    else:
                        clientAddr = resp.getheader("Requesting-Client").split(":")
                        thisReq = self.nextReq
                        self.nextReq = parseLinkHeaders(resp)["next"]
                        return (ReverseHttpRequest(thisReq, self.server_address, resp.read()),
                                clientAddr)
            except:
                if self.reportPollExceptions:
                    self.report_poll_exception()
            time.sleep(self.failureDelay)
            if self.failureDelay < 30:
                self.failureDelay = self.failureDelay * 2

    def handle_error(self, request, client_address):
        if not request.closed:
            try:
                request.write("HTTP/1.0 500 Internal Server Error\r\n\r\n")
                request.close()
            except:
                pass

    def report_poll_exception(self):
        import traceback
        traceback.print_exc()

    def on_location_changed(self):
        if self.locationChangeCallback:
            self.locationChangeCallback(self)

def parseLinkHeaders(resp):
    result = {}
    for linkHeader in resp.getheader("Link").split(", "):
        for piece in linkHeader.split(";"):
            piece = piece.strip()
            if piece[0] == '<':
                url = piece[1:-1]
            elif piece[:5].lower() == 'rel="':
                rel = piece[5:-1]
        if url and rel:
            result[rel] = url
    return result

class ForkingReverseHttpServer(SocketServer.ForkingMixIn, ReverseHttpServer): pass
class ThreadingReverseHttpServer(SocketServer.ThreadingMixIn, ReverseHttpServer): pass

class ReverseHttpRequest:
    def __init__(self, replyUrl, server_address, body):
        self.replyUrl = replyUrl
        self.server_address = server_address
        self.body = body
        self.responseBuffer = StringIO.StringIO()
        self.closed = False

    def makefile(self, mode, bufsize):
        if mode[0] == 'r':
            return StringIO.StringIO(self.body)
        elif mode[0] == 'w':
            return self

    def write(self, x):
        return self.responseBuffer.write(x)

    def flush(self):
        pass

    def close(self):
        self.responseBuffer.flush()
        respbody = self.responseBuffer.getvalue()

        fetch(self.replyUrl, respbody, "message/http")
        self.closed = True
        
def test():
    import sys

    if len(sys.argv) > 1:
        label = sys.argv[1]
    else:
        label = 'python'

    if len(sys.argv) > 2:
        s = sys.argv[2]
    else:
        s = 'http://localhost:8000/reversehttp'

    class TestHandler(BaseHTTPServer.BaseHTTPRequestHandler):
        counter = 0
        def do_POST(self):
            self.do_GET()
        def do_GET(self):
            self.send_response(200)
            self.send_header("Content-type", "text/plain")
            self.end_headers()
            self.wfile.write("This is response #" + str(TestHandler.counter) + "\r\n")
            TestHandler.counter = TestHandler.counter + 1

    def updateLocation(httpd):
        print 'Serving HTTP on '+httpd.location+' ...'

    httpd = ReverseHttpServer(label, s, TestHandler)
    httpd.locationChangeCallback = updateLocation
    httpd.serve_forever()

if __name__ == '__main__':
    test()

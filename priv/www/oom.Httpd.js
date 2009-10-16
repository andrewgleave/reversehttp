var oom = {};
oom.Utility = {
    SetHeadersForObject: function(obj, text) {
        if(!text) return
        obj.headers = $H({});
        do {
            var parts = text.match(/([^:]+):[ \t]*([^\r\n]*)\r\n/);
            if(parts) {
                obj.headers.set(parts[1].toLowerCase(), parts[2]);
                text = text.substring(parts[0].length);
            }
        } while($defined(parts));
        obj.body = text.substring(2);
    },
    FormatHttpHeadersAndBody: function(response, lineList) {
        $H(response.headers).combine({'Content-Length': response.body.encodeUtf8().length}).each(function(value, key) {
            lineList.push(key + ': ' + value);
        });
        lineList.push('');
        lineList.push(response.body);
        return lineList.join('\r\n');
    },
    IsValidResponse: function(status) {
        return ((status >= 200 && status < 300) || status == 1223);
    }
}


oom.Request = new Class({
    Implements: [Options],
    options: {
        uri: '',
        context: {},
        source: '',
    },
    initialize: function(options) {
        this.setOptions(options);
        $merge(this, this.options);
        this.parse();
    },
    parse: function() {
        var parts = this.options.source.match(/([^ ]+) ([^ ]+) HTTP\/([0-9]+\.[0-9]+)\r\n/);
        this.method = parts[1].toLowerCase();
        this.rawPath = parts[2];
        this.httpVersion = parts[3];
        oom.Utility.SetHeadersForObject(this, this.options.source.substring(parts[0].length));
    },
    respond: function(response) {
        new Request({url: this.options.uri,
                    method: 'post',
                    data: response.serialize(),
                    headers:{'Content-type': 'message/http'}}).send();
    }
});


oom.Response = new Class({
    Implements: [Options],
    options: {
        status: '',
        message: '',
        headers: {},
        body: '',
        raw: null,
        httpVersion: '1.1'
    },
    initialize: function(options) {
        this.setOptions(options);
        this.headerPattern = 'HTTP/{version} {status} {message}';
        this.body = this.options.body;
        this.headers = $H(this.options.headers);
        oom.Utility.SetHeadersForObject(this, this.options.raw);
    },
    serialize: function() {
        return oom.Utility.FormatHttpHeadersAndBody(this,
                [this.headerPattern.substitute({'version': this.options.httpVersion,
                                                'status': this.options.status,
                                                'message': this.options.message})]);
    },
    valid: function() {
        return oom.Utility.IsValidResponse(this.options.status.toInt());
    }
});


oom.Response.FromSource = function(text) {
    var parts = text.match(/HTTP\/([0-9]+\.[0-9]+) ([0-9]+) ([^\r\n]*)\r\n/);
    return new oom.Response({status: parts[2],
                           message: parts[3],
                           httpVersion: parts[1],
                           raw: text.substring(parts[0].length)});
}


oom.Relay = new Class({
    Implements: [Options, Events],
    options: {
        method: 'post',
        url: '',
        headers: {},
        body: '',
        async: true,
        onComplete: $empty,
        onError: $empty,
        accessPoint: '/reversehttp/_relay/{host}',
        httpVersion: '1.1'
    },
    initialize: function(options) {
        this.setOptions(options);
        this.uri = new URI(this.options.url);
        this.body = this.options.body;
        this.headers = $H(this.options.headers);
        new Request({url: this.requestUri(),
                    method: 'post',
                    headers: {'Content-Type': 'message/http', 'host': this.uri.getFullHost()},
                    data: this.serialize(),
                    urlEncoded: false,
                    encoding: false,
                    async: this.options.async,
                    onComplete: function(text) {
                        var response = oom.Response.FromSource(text);
                        dbug.log('Relay completed with' + text);
                        if(response.valid())
                            this.fireEvent('complete', response);
                    }.bind(this),
                    onError: this.fireEvent('error')
        }).send();
    },
    requestUri: function() {
        return this.options.accessPoint.substitute({host: this.uri.getFullHost()});
    },
    serialize: function() {
        return oom.Utility.FormatHttpHeadersAndBody(this,
                [this.options.method.toUpperCase() + ' ' + this.options.url + ' HTTP/' + this.options.httpVersion]);
    }
});


oom.Server = new Class({
    Implements: [Options, Events],
    options: {
        label: 'auto',
        token: '-',
        callback: $empty,
        failureDelay: 2000,
        onLocationChanged: $empty,
        accessPoint: '/reversehttp'
    },
    initialize: function(options) {
        this.setOptions(options);
        this.failureDelay = this.options.failureDelay;
        this.running = false;
        this.nextReq = null;
        this.location = null;
        this.request = null;
        if(this.options.label == 'auto')
            this.options.label = new ReadableIdentifier().id;
    },
    start: function() {
        this.running = true;
        this.serve(250);
        dbug.log('Setting label' + this.options.label);
    },
    stop: function() {
        this.running = false;
        if(this.request) {
            this.request.cancel()
            this.request = null;
            this.nextReq = null;
        }
    },
    restart: function() {
        if(this.running) this.stop();
        this.start();
    },
    serve: function(period) {
        if(!this.running) return;
        if(!$defined(period) || (period == 0 && !Browser.Engine.trident))
            this.sendResponse();
        else
            (function() {this.sendResponse()}).delay(period, this);
    },
    sendResponse: function() {
        if(!this.nextReq)
            this.request = new Request({url: this.options.accessPoint,
                                        method: 'post',
                                        data: {name: this.options.label, token: this.options.token},
                                        onComplete: this.process.bind(this)}).send();
        else
            this.request = new Request({url: this.nextReq,
                                        method: 'get',
                                        onComplete: this.process.bind(this)}).send();
    },
    process: function(text) {
        if(!this.running) return;
        if (!oom.Utility.IsValidResponse(this.request.status)) {
            dbug.log('Poll request failed - status ' + this.request.status + '; delaying ' + this.failureDelay);
            this.serve(this.failureDelay);
            if(this.failureDelay < (this.options.failureDelay * 10))
                this.failureDelay *= 2;
            return;
        }
        if(this.failureDelay > this.options.failureDelay) {
            this.failureDelay = this.options.failureDelay;
            dbug.log('Recovered; resetting delay');
        }
        if(this.nextReq)
            this.handleRetrieve(text)
        else
            this.handleSubscribe(text);
        this.request = null;
        this.serve();
    },
    handleSubscribe: function(text) {
        var links = this.parseLink(this.request.getHeader('Link'));
        this.nextReq = links.get('first');
        if(links.has('related')) {
            this.location = links.get('related');
            this.fireEvent('locationChanged', this.location);
        }
        dbug.log('Label ' + this.options.label + ' maps to ' + this.location);
        dbug.log('First request is at ' + this.nextReq);
    },
    handleRetrieve: function(text) {
        if(text) {
            try {
                var request = new oom.Request({uri: this.nextReq,
                                                context: {requestingClient: this.request.getHeader('Requesting-Client')},
                                                source: text});
                this.nextReq = this.parseLink(this.request.getHeader('Link')).get('next');
                try {
                    this.options.callback(request);
                }
                catch(ex) {
                    dbug.log('HTTPD CALLBACK ERROR: ' + JSON.encode(ex));
                    request.respond(500, {}, 'oom.Httpd.js callback internal server error');
                }
            }
            catch(ex) {
                dbug.log('HTTPD ERROR: ' + JSON.encode(ex));
            }
        }
    },
    parseLink: function(text) {
        var result = $H({});
        if(text) {
            text.split(', ').each(function(i) {
                var url, rel;
                i.split(';').each(function(j) {
                    var m = j.match(/<\s*(\S+)\s*>/);
                    if(m)
                        url = m[1]
                    else {
                        m = j.match(/(\w+)="(\w*)"/);
                        if(m) {
                            if(m[1].toLowerCase() == 'rel')
                                rel = m[2];
                        }
                    }
                });
                if(rel && url)
                    result.set(rel, url);
            });
        }
        return result;
    }
});
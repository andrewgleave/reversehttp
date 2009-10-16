oom.MessageStatus = $H({
    200: "OK",
    204: "OK",
    400: "Invalid request",
    403: "Forbidden",
    404: "Destination not found",
    500: "Internal messaging server error",
    501: "Unsupported method"
});


oom.MessageServer = new Class({
    Implements: [Options, Events],
    options: {
        label: 'auto',
        serverOptions: {
            onLocationChanged: function(text) {
                this.locationChanged(text);
                this.fireEvent('locationChanged', text);
            },
        },
        onLocationChanged:$empty
    },
    initialize: function(options) {
        this.setOptions(options);
        this.pathMap = $H({});
        this.location = '';
        this.server = new oom.Server({label: this.options.label,
                                    callback: this.process.bind(this),
                                    onLocationChanged: this.options.serverOptions.onLocationChanged.bind(this)});
        this.server.start();
    },
    process: function(request) {
        
        function respond(status, body, contentType) {
            var message = oom.MessageStatus.get(status) || 'Unknown';
            if (status == 204)
                request.respond(new oom.Response({status: status,
                                message: message,
                                body: ''}));
            else
                request.respond(new oom.Response({status: status,
                                message: message,
                                headers: {'Content-type': (contentType || 'text/plain')},
                                body: body || message}));
        }
        
        if(request.rawPath.substr(0, this.pathPrefix.length) != this.pathPrefix) {
            respond(404);
            return;
        }
        var bits = this.parseRequest(request.rawPath);
        try {
            var recipient = this.pathMap[bits.get('target')];
            var remainder = bits.get('uri').get('directory');
            if(!recipient) {
                recipient = this.pathMap.get('');
                var remainder = bits.get('uri').get('directory');
            }
            if(recipient) {
                var params = $H({});
                var querystring = bits.get('uri').get('query');
                if(querystring)
                    params = $H(querystring.parseQueryString());
                if(recipient[request.method])
                    recipient[request.method](request, remainder, params, respond);
                else
                    if(recipient.options.fallback)
                        recipient.options.fallback(request, remainder, params, respond);
                    else
                        respond(501);
            }
            else
                respond(404);
        }
        catch(e) {
            respond(500);
        }
    },
    parseRequest: function(text) {
        var res = $H({'uri': new URI(text.substr(this.pathPrefix.length)),
                    'target': '',
                    'remainder': ''});
        var slashPos = res.get('uri').get('file').indexOf('/');
        if(slashPos != -1) {
            res.set('target', res.get('uri').get('file').substr(0, slashPos));
            res.set('remainder', res.get('uri').get('file').substr(slashPos + 1));
        }
        else
            res.set('target', res.get('uri').get('file'));
        return res;
    },
    bind: function(name, receiver) {
        this.pathMap.set(name, receiver);
    },
    unbind: function(name) {
        this.pathMap.erase(name);
    },
    locationChanged: function(text) {
        this.location = new URI(text);
        this.pathPrefix = this.location.get('directory');
    }
});


oom.EndpointFacet = new Class({
    Implements: Options,
    options: {
        maxAge: 300,
        fallback: function(request, path, params, respond) {
            var method = request.method + '_' + (params.get('hub.mode') || "");
            if (this[method])
                this[method](request, path, params, respond);
            else
                respond(501);
        }
    },
    initialize: function(sink, options) {
        this.setOptions(options)
        this.sink = sink;
        this.options.fallback = this.options.fallback.bind(this);
    },
    generate_token: function (path, intendedUse) {
        return (new Number(new Date())) + ":" + intendedUse + ":" + path;
    },
    check_token: function(token, path, actualUse) {
        var m = token.match(/^([0-9]+):([^:]+):(.*)/);
        if(!m || ((new Number(new Date())) - Number(m[1])) > (this.options.maxAge * 1000) ||
            (actualUse != m[2]) || (path != m[3]))
            return false;
        return this.sink.checkAction(actualUse, path);
    },
    check_http_token: function(httpReq, path, params, respond, actualUse) {
        if(this.check_token(params.get('hub.verify_token') || '', path, actualUse))
            respond(200, params.get('hub.challenge') || '');
        else
            respond(400);
    },
    get_subscribe: function(httpReq, path, params, respond) {
        this.check_http_token(httpReq, path, params, respond, 'subscribe');
    },
    get_: function(httpReq, path, params, respond) {
        respond(200, 'Endpoint facet');
    },
    get_unsubscribe: function(httpReq, path, params, respond) {
        this.check_http_token(httpReq, path, params, respond, 'unsubscribe');
    },
    get_generate_token: function(httpReq, path, params, respond) {
        var token = 'hub.verify_token=' + this.generate_token(path, params.get('hub.intended_use'));
        respond(200,  token, 'application/x-www-form-urlencoded');
    },
    post: function(httpReq, path, params, respond) {
        this.sink.deliver(params.get('hub.topic') || '', httpReq.headers.get('content-type'), httpReq.body);
        respond(204);
    }
});


oom.HubModeRequest = function(url, method, mode, params, respond) {
    return new oom.Relay({method: method,
                        url: url + '?hub.mode=' + mode + $H(params).toQueryString(),
                        onComplete: respond,
                        onError: respond});
};


oom.RemoteEndpoint = new Class({
    Implements: Options,
    options: {
        url: ''
    },
    initialize: function(options) {
        this.setOptions(options);
    },
    generate_token: function(intendedUse, respond) {
        oom.HubModeRequest(this.options.url, 'get', 'generate_token', {'hub.intended_use': intendedUse},
                            function(reply) {
                                if(!reply || !reply.valid()) return respond(null);
                                var m = reply.body.match(/^hub\.verify_token=(.*)$/);
                                if(!m) return respond(null);
                                return respond(m[1]);
                            }
        );
    },
    check_token: function(token, actualUse, respond) {
        var challenge = new Number(new Date());
        var params = ($type(token) == 'string') ? {'hub.challenge': challenge, 'hub.verify_token': token} : {};
        oom.HubModeRequest(this.url, 'get', actualUse, params,
                            function(reply) {
                                alert(uneval({'challenge': challenge, 'body': body}));
                                return respond(reply && reply.valid() && reply.body == challenge);
                            }
        );
    },
    deliver: function(topic, body, contentType, respond) {
        new HttpRelay({method: 'post',
                        url: this.url + '?hub.topic=' + topic,
                        headers: contentType ? {'Content-type': contentType} : {},
                        body: body,
                        onComplete: function(reply) {
                            respond(reply.valid());
                        },
                        onError: function() {
                            respond(false);
                        }
        });
    }
});


oom.RemoteSource = new Class({
    Implements: Options,
    options: {
        uri: ''
    },
    initialize: function(options) {
        this.setOptions(options);
    },
    subscribe: function(callbackUrl, topic, verifyModes, token, respond) {
        oom.HubModeRequest(this.options.url, 'post', 'subscribe',
                        {'hub.callback': callbackUrl,
                        'hub.topic': topic,
                        'hub.verify': verifyModes,
                        'hub.verify_token': token},
                        function(reply) {
                            return respond(reply && reply.valid());
                        }
        );
    },
    unsubscribe: function(callbackUrl, topic, verifyModes, token, respond) {
        oom.HubModeRequest(this.options.url, 'post', 'unsubscribe',
                        {'hub.callback': callbackUrl,
                        'hub.topic': topic,
                        'hub.verify': verifyModes,
                        'hub.verify_token': token},
                        function(reply) {
                            return respond(reply && reply.valid());
                        }
        );
    }
});
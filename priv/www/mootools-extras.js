//MooTools More, <http://mootools.net/more>. Copyright (c) 2006-2009 Aaron Newton <http://clientcide.com/>, Valerio Proietti <http://mad4milk.net> & the MooTools team <http://mootools.net/developers>, MIT Style License.
// dbug.js A wrapper for Firebug console.* statements. http://www.clientcide.com/wiki/cnet-libraries#license
// ReadableIdentifier - Andrew  Gleave 2009
MooTools.More={version:"1.2.3.1"};Class.refactor=function(b,a){$each(a,function(d,c){var e=b.prototype[c];if(e&&(e=e._origin)&&typeof d=="function"){b.implement(c,function(){var f=this.previous;
this.previous=e;var g=d.apply(this,arguments);this.previous=f;return g})}else{b.implement(c,d)}});return b};String.implement({parseQueryString:function(){var b=this.split(/[&;]/),a={};
if(b.length){b.each(function(d){var e=d.indexOf("="),f=e<0?[""]:d.substr(0,e).match(/[^\]\[]+/g),g=decodeURIComponent(d.substr(e+1)),c=a;
f.each(function(i,h){var j=c[i];if(h<f.length-1){c=c[i]=j||{}}else{if($type(j)=="array"){j.push(g)}else{c[i]=$defined(j)?[j,g]:g
}}})})}return a},cleanQueryString:function(a){return this.split("&").filter(function(e){var b=e.indexOf("="),c=b<0?"":e.substr(0,b),d=e.substr(b+1);
return a?a.run([c,d]):$chk(d)}).join("&")}});var URI=new Class({Implements:Options,regex:/^(?:(\w+):)?(?:\/\/(?:(?:([^:@]*):?([^:@]*))?@)?([^:\/?#]*)(?::(\d*))?)?(\.\.?$|(?:[^?#\/]*\/)*)([^?#]*)(?:\?([^#]*))?(?:#(.*))?/,parts:["scheme","user","password","host","port","directory","file","query","fragment"],schemes:{http:80,https:443,ftp:21,rtsp:554,mms:1755,file:0},initialize:function(c,b){this.setOptions(b);
var a=this.options.base||URI.base;c=c||a;if(c&&c.parsed){this.parsed=$unlink(c.parsed)}else{this.set("value",c.href||c.toString(),a?new URI(a):false)
}},parse:function(a,c){var b=a.match(this.regex);if(!b){return false}b.shift();return this.merge(b.associate(this.parts),c)
},merge:function(b,a){if((!b||!b.scheme)&&(!a||!a.scheme)){return false}if(a){this.parts.every(function(c){if(b[c]){return false
}b[c]=a[c]||"";return true})}b.port=b.port||this.schemes[b.scheme.toLowerCase()];b.directory=b.directory?this.parseDirectory(b.directory,a?a.directory:""):"/";
return b},parseDirectory:function(c,a){c=(c.substr(0,1)=="/"?"":(a||"/"))+c;if(!c.test(URI.regs.directoryDot)){return c}var b=[];
c.replace(URI.regs.endSlash,"").split("/").each(function(d){if(d==".."&&b.length>0){b.pop()}else{if(d!="."){b.push(d)}}});
return b.join("/")+"/"},combine:function(a){return a.value||a.scheme+"://"+(a.user?a.user+(a.password?":"+a.password:"")+"@":"")+(a.host||"")+(a.port&&a.port!=this.schemes[a.scheme]?":"+a.port:"")+(a.directory||"/")+(a.file||"")+(a.query?"?"+a.query:"")+(a.fragment?"#"+a.fragment:"")
},set:function(d,b,a){if(d=="value"){var c=b.match(URI.regs.scheme);if(c){c=c[1]}if(c&&!$defined(this.schemes[c.toLowerCase()])){this.parsed={scheme:c,value:b}
}else{this.parsed=this.parse(b,(a||this).parsed)||(c?{scheme:c,value:b}:{value:b})}}else{if(d=="data"){this.setData(b)}else{this.parsed[d]=b
}}return this},get:function(a,b){switch(a){case"value":return this.combine(this.parsed,b?b.parsed:false);case"data":return this.getData()
}return this.parsed[a]||undefined},go:function(){document.location.href=this.toString()},toURI:function(){return this},getData:function(a,d){var c=this.get(d||"query");
if(!$chk(c)){return a?null:{}}var b=c.parseQueryString();return a?b[a]:b},setData:function(b,a,c){if($type(arguments[0])=="string"){b=this.getData();
b[arguments[0]]=arguments[1]}else{if(a){b=$merge(this.getData(),b)}}return this.set(c||"query",Hash.toQueryString(b))},clearData:function(a){return this.set(a||"query","")
}});["toString","valueOf"].each(function(a){URI.prototype[a]=function(){return this.get("value")}});URI.regs={endSlash:/\/$/,scheme:/^(\w+):/,directoryDot:/\.\/|\.$/};
URI.base=new URI($$("base[href]").getLast(),{base:document.location});String.implement({toURI:function(a){return new URI(this,a)
}});var dbug={logged:[],timers:{},firebug:false,enabled:false,log:function(){dbug.logged.push(arguments)},nolog:function(b){dbug.logged.push(arguments)
},time:function(b){dbug.timers[b]=new Date().getTime()},timeEnd:function(c){if(dbug.timers[c]){var d=new Date().getTime()-dbug.timers[c];
dbug.timers[c]=false;dbug.log("%s: %s",c,d)}else{dbug.log("no such timer: %s",c)}},enable:function(e){var f=window.firebug?firebug.d.console.cmd:window.console;
if((!!window.console&&!!window.console.warn)||window.firebug){try{dbug.enabled=true;dbug.log=function(){(f.debug||f.log).apply(f,arguments)
};dbug.time=function(){f.time.apply(f,arguments)};dbug.timeEnd=function(){f.timeEnd.apply(f,arguments)};if(!e){dbug.log("enabling dbug")
}for(var h=0;h<dbug.logged.length;h++){dbug.log.apply(f,dbug.logged[h])}dbug.logged=[]}catch(g){dbug.enable.delay(400)}}},disable:function(){if(dbug.firebug){dbug.enabled=false
}dbug.log=dbug.nolog;dbug.time=function(){};dbug.timeEnd=function(){}},cookie:function(g){var h=document.cookie.match("(?:^|;)\\s*jsdebug=([^;]*)");
var e=h?unescape(h[1]):false;if((!$defined(g)&&e!="true")||($defined(g)&&g)){dbug.enable();dbug.log("setting debugging cookie");
var f=new Date();f.setTime(f.getTime()+(24*60*60*1000));document.cookie="jsdebug=true;expires="+f.toGMTString()+";path=/;"
}else{dbug.disableCookie()}},disableCookie:function(){dbug.log("disabling debugging cookie");document.cookie="jsdebug=false;path=/;"
}};(function(){var i=!!window.console||!!window.firebug;var f=window.firebug?window.firebug.d.console.cmd:window.console;
var j=["debug","info","warn","error","assert","dir","dirxml"];var g=["trace","group","groupEnd","profile","profileEnd","count"];
function h(a,c){for(var b=0;b<a.length;b++){dbug[a[b]]=(i&&f[a[b]])?f[a[b]]:c}}h(j,dbug.log);h(g,function(){})})();if((!!window.console&&!!window.console.warn)||window.firebug){dbug.firebug=true;
var value=document.cookie.match("(?:^|;)\\s*jsdebug=([^;]*)");var debugCookie=value?unescape(value[1]):false;if(window.location.href.indexOf("jsdebug=true")>0||debugCookie=="true"){dbug.enable()
}if(debugCookie=="true"){dbug.log("debugging cookie enabled")}if(window.location.href.indexOf("jsdebugCookie=true")>0){dbug.cookie();
if(!dbug.enabled){dbug.enable()}}if(window.location.href.indexOf("jsdebugCookie=false")>0){dbug.disableCookie()}}var ReadableIdentifier=new Class({Implements:Options,options:{pattern:"{start}{numeric}{end}",shuffle:false,alphaLength:6,numericLength:2,bannedFragments:[]},initialize:function(b){this.setOptions(b);
this.numbers="0123456789";this.vowels="aeiouy";this.consonants="bcdfghjklmnpqrstvwxz";this.generate()},generate:function(){var g=Math.floor(this.options.alphaLength/2);
var h="";if(this.options.alphaLength%2){g++}var f=this.options.alphaLength-g;for(var e=0;e<this.options.numericLength;e++){h+=this.randomChar(this.numbers)
}this.id=this.options.pattern.substitute({start:this.buildAlpha(g),numeric:h,end:this.buildAlpha(f)});if(this.options.shuffle){this.id=this.id.split("").shuffle().join("")
}return this.id},buildAlpha:function(f){while(true){var d="";for(var e=0;e<f;e++){d+=(e%2)?this.randomChar(this.vowels):this.randomChar(this.consonants)
}if(this.options.bannedFragments.every(function(a){return !d.contains(a)})){}return d}},randomChar:function(b){return b.charAt(Math.floor(Math.random()*b.length))
}});URI.implement({getFullHost:function(){return this.get("port")?this.get("host")+":"+this.get("port"):this.get("host")}});
Array.implement({shuffle:function(){for(var b,a,c=this.length;c;b=parseInt(Math.random()*c),a=this[--c],this[c]=this[b],this[b]=a){}return this
}});String.implement({decodeUtf8:function(){return decodeURIComponent(escape(this))},encodeUtf8:function(){return unescape(encodeURIComponent(this))
},randomChar:function(){return this.charAt(Math.floor(Math.random()*this.length))}});
/**
 * Trebuchet - Let's chuck some email!
 *
 * @author Andrew Sliwinski <andrew@diy.org>
 * @contributor Nick Baugh <niftylettuce@gmail.com>
 */

/**
 * Dependencies
 */
var fs          = require('fs'),
    path        = require('path'),
    _           = require('underscore'),
    async       = require('async'),
    request     = require('request'),
    handlebars  = require('handlebars');

/**
 * Module
 */
module.exports = function (config) {

    // Storage object
    var outbox     = [];
    
    // cache for compiled templates
    var compiledTemplates = {};

    // Configure w/ backwards compatible API key passed as string
    if (_.isString(config)) {
        config = {
            apikey: config
        };
    }

    _.defaults(config, {
        apikey: 'POSTMARK_API_TEST',
        env: 'PRODUCTION',
        templateDirectory: './templates'
    });
    
    handlebars.registerHelper('nl2br', function(text) {
        text = handlebars.Utils.escapeExpression(text);
        var nl2br = (text + '').replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1' + '<br>' + '$2');
        return new handlebars.SafeString(nl2br);
    });

    handlebars.registerHelper('capitalize', function(text) {
        text = handlebars.Utils.escapeExpression(text);
        var capitalized = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
        return new handlebars.SafeString(capitalized);
    });

    handlebars.registerHelper('ticketEvent', function(type, text, opts) {
        var ticketEvent = handlebars.Utils.escapeExpression(text);

        for (var prop in opts.hash) {
            opts.hash[prop] = handlebars.Utils.escapeExpression(opts.hash[prop]);
        }

        switch(type) {
            case 'agent_assigned_to_agent':
                ticketEvent = ticketEvent.replace('%operator%', opts.hash.operator)
                    .replace('%assignee%', '<strong>'+opts.hash.assignee+'</strong>');
                break;
            case 'assigned_to_agent':
                ticketEvent = ticketEvent.replace('%assignee%', '<strong>'+opts.hash.assignee+'</strong>');
                break;
            case 'changed_ticket_status':
                opts.hash.previousStatus = handlebars.helpers.capitalize.call(this, opts.hash.previousStatus);
                opts.hash.currentStatus = handlebars.helpers.capitalize.call(this, opts.hash.currentStatus);
                ticketEvent = ticketEvent.replace('%operator%', opts.hash.operator)
                    .replace('%previous_status%', opts.hash.previousStatus)
                    .replace('%current_status%', '<strong>'+opts.hash.currentStatus+'</strong>');
                break;
            case 'status_changed':
                opts.hash.previousStatus = handlebars.helpers.capitalize.call(this, opts.hash.previousStatus);
                opts.hash.currentStatus = handlebars.helpers.capitalize.call(this, opts.hash.currentStatus);
                ticketEvent = ticketEvent.replace('%previous_status%', opts.hash.previousStatus)
                    .replace('%current_status%', '<strong>'+opts.hash.currentStatus+'</strong>');
                break;
            case 'changed_ticket_subject':
                ticketEvent = ticketEvent.replace('%operator%', opts.hash.operator)
                    .replace('%subject%', '<strong>'+opts.hash.subject+'</strong>');
                break;
            case 'changed_requester_email':
                ticketEvent = ticketEvent.replace('%operator%', opts.hash.operator)
                    .replace('%email%', '<strong>'+opts.hash.email+'</strong>');
                break;
            case 'you_were_assigned':
            case 'agent_solved_ticket':
                ticketEvent = ticketEvent.replace('%operator%', opts.hash.operator);
                break;
            case 'follow_up_sent':
            case 'rating_offer_sent':
                ticketEvent = ticketEvent.replace('%name%', '<strong>'+opts.hash.name+'</strong>');
                break;
            case 'rated':
                ticketEvent = ticketEvent.replace('%name%', '<strong>'+opts.hash.name+'</strong>')
                    .replace('%rate%', '<strong>'+opts.hash.rate+'</strong>');
                break;
        }

        return new handlebars.SafeString(ticketEvent);
    });

    handlebars.registerHelper('referrershort', function (text) {
        text = handlebars.Utils.escapeExpression(text);
        referrershort = text.length > 60 ? text.substring(0, 60) + '...' : text;
        return new handlebars.SafeString(referrershort);
    });

    // ---------------------------
    // ---------------------------

    /**
     * Fling - sends a single email to a single target
     *
     * @param {Object} - params: Postmark API "params", e.g. from, to, subject
     *                 - html
     *                 - text
     *                 - data
     *
     * @return {Function}
     */
    var fling = function (options, callback) {
        _.defaults(options, {
            params: {},
            html: '',
            text: '',
            data: {},
            templateName: ''
        });

        compile(options.html, options.text, options.data, options.templateName, function (err, content) {
            if (err) return callback(err, content);

            try {
                var message = options.params;
                message.htmlbody = content.html;
                message.textbody = content.text;
                send(message, callback);
            } catch (err) {
                callback(err);
            }
        });
    };

    /**
     * Loads a piece of mail into the outbox.
     *
     * @param {Object} Postmark API params
     *
     * @return {Function}
     */
    var load = function (options, callback) {
        _.defaults(options, {
            params: {},
            html: '',
            text: '',
            data: {},
            templateName: ''
        });

        compile(options.html, options.text, options.data, options.templateName, function (err, content) {
            if (err) return callback(err, content);

            try {
                var message = options.params;
                message.htmlbody = content.html;
                message.textbody = content.text;
                if (outbox.length >= 500) {
                    callback('Postmark API batch size limit has been reached.', outbox.length);
                } else {
                    outbox.push(message);
                    callback(null, outbox.length);
                }
            } catch (err) {
                callback(err);
            }
        });
    };

    /**
    * Fires all of the mail in the outbox.
    *
    * @return {Function}
    */
    var fire = function (callback) {
        var outboxCopy = _.clone(outbox);
        outbox = [];
        send(outboxCopy, callback);
    };

    /**
     * Compiles templates and returns rendered result.
     *
     * @param {String} File path
     * @param {String} File path
     * @param {String} File path
     * @param {Object} Template locals
     * @param {String} Template directory
     * 
     * @return {Function}
     */
    var compile = function (html, text, data, templateName, callback) {
        // Check if we're going to use a template
        if (templateName !== '') {
            html = path.join(config.templateDirectory, templateName, 'index.html');
            text = path.join(config.templateDirectory, templateName, 'index.txt');
        }
        
        // Processor
        var proc = function (input, data, callback) {
            var abspath = path.resolve(input),
                buffer  = '',
                compiledTemplate,
                result,
                msg;
            
            compiledTemplate = compiledTemplates[abspath];
            
            function proceed(data, callback) {
                result = compiledTemplate(data);
                callback(false, result);
            };
            
            if(!compiledTemplate)
            {
                fs.readFile(abspath, 'utf-8', function(err, template){
                    if (err) {
                        return callback(err, template);
                    }

                    try {
                        compiledTemplate = compiledTemplates[abspath] = handlebars.compile(template);
                        proceed(data, callback);
                    }
                    catch(e)
                    {
                        msg = 'Caught an exception while processing file: ' + abspath + '\n';
                        msg += e.toString()
                        callback(true, msg);
                    }
                });
            }
            else
            {
                proceed(data, callback);
            }
        };

        // Compile & return HTML and text inputs
        async.parallel({
            html: function (callback) { proc(html, data, callback); },
            text: function (callback) { proc(text, data, callback); }
        }, function(err, res){
            callback(err,res);
        });
    };

    /**
     * Sends a request to the Postmark API.
     *
     * @param {Object} Message
     *
     * @param {Function}
     */
    var send = function (message, callback) {
        var url = {
            batch: 'https://api.postmarkapp.com/email/batch',
            email: 'https://api.postmarkapp.com/email'
        };

        var uri = (_.isArray(message)) ? url.batch : url.email;

        request({
            uri:        uri,
            method:     'POST',
            headers:    { 'X-Postmark-Server-Token': config.apikey },
            json:       message
        }, function (e, r, body) {
            if (e) {
                return callback(e);
            }

            if (r.statusCode !== 200 || (_.isArray(message) && _.filter(body,function (obj) {return obj.ErrorCode !== 0}).length)) {
                callback({StatusCode: r.statusCode, Body: body});
            } else {
                callback(null, body);
            }
        });
    };

    // ---------------------------
    // ---------------------------
  
    return {
        fling: fling,
        load: load,
        fire: fire
    };

};
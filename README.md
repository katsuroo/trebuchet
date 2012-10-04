# Trebuchet

#### Let's chuck some email!

Trebuchet is a node.js module for super simple email transactions using the [Postmark API](http://postmarkapp.com) and [Handlebars](https://github.com/wycats/handlebars.js) with [Juice](https://github.com/LearnBoost/juice) for templating. Trebuchet was designed with simple email rendering, batching and API operations in mind.

[![Build Status](https://secure.travis-ci.org/thisandagain/trebuchet.png?branch=master)](http://travis-ci.org/thisandagain/trebuchet)

## Installation

```bash
npm install trebuchet
```

## Basic Use (Fling Pattern)

```javascript
var trebuchet = require('trebuchet')('yourapikey');

trebuchet.fling({
    params: {
        from: 'you@domain.com',
        to: 'someone@domain.com',
        subject: 'This is only a test of the fling pattern'
    },
    html: 'path/to/template/fling.html',
    text: 'path/to/template/fling.txt',
    data: {
        foo: 'Bar'
    }
}, function (err, response) {
    // Win!
});
```

## Basic Use (Fling Pattern with HTML friendly inlined-CSS support)

```javascript
var trebuchet = require('trebuchet')('yourapikey');

trebuchet.fling({
    params: {
        from: 'you@domain.com',
        to: 'someone@domain.com',
        subject: 'This is only a test of the fling pattern'
    },
    html: 'path/to/template/fling.html',
    css: 'path/to/template/fling.css',
    text: 'path/to/template/fling.txt',
    data: {
        foo: 'Bar'
    }
}, function (err, response) {
    // Win!
});
```

## Batch Sender (Load --> Fire Pattern)

The batch sender uses the [Postmark API's batch method](http://developer.postmarkapp.com/developer-build.html#batching-messages) to support sending groups of messages (up to 500 at a time).

**NOTE**: You can also pass a css variable to load a stylesheet that will be inlined using `juice`.

```javascript
var trebuchet = require('trebuchet')('yourapikey');

trebuchet.load({
    params: {
        from: 'you@domain.com',
        to: 'someone@domain.com',
        subject: 'This is only a test of the load/fire pattern'
    },
    html: 'path/to/template/fire.html',
    text: 'path/to/template/fire.txt',
    data: {
        foo: 'Bar',
        name: 'Bubba'
    }
}, function (err, response) {
    // Loaded!
});
```

```javascript
trebuchet.fire(function (err, response) {
    // Win!
});
```

## Templating

This fork of Trebuchet uses [Handlebars](https://github.com/wycats/handlebars.js) templates to make sending dynamic HTML and plain-text emails super-duper simple.

**NEW**: We've added support [Juice](https://github.com/LearnBoost/juice) which allows one to pass a `css` variable and inline the CSS with the HTML template for email-friendly CSS... KA POW! (thanks to @niftylettuce)

An example template:

```html
<html>
    <body>
        <h1>{{greeting}}</h1>
    </body>
</html>
```

With example data:

```javascript
{
    greeting: 'Hello World!'
}
```

Result (without CSS argument):

```html
<html>
    <body>
        <h1>Hello World!</h1>
    </body>
</html>
```

Result (with CSS argument, e.g. "some/path/to/template.css"):

```html
<html>
    <body style="color:yellow;background-color:black;">
        <h1>Hello World!</h1>
    </body>
</html>
```

Instead of having to pass `html`, `css`, and `text` options every time, you can simply pass a `templateName`, as long as you have defined a `templateDirectory`.

```javascript
var trebuchet = require('trebuchet', { apikey: 'yourapikey', templateDirectory: path.join(__dirname, 'templates') });

trebuchet.fling({
    params: {
        from: 'you@domain.com',
        to: 'someone@domain.com',
        subject: 'This is only a test of template usage'
    },
        // the template property will automatically load and set the following options without you having to manually set them
        // * html: ~/templates/fling-test/index.html
        // * css:  ~/templates/fling-test/index.css
        // * text: ~/templates/fling-test/index.txt
        template: 'fling-test',
        data: {
            foo: 'Bar'
        }
    }, function(err, response) {
        // Template Win!
    });
```

## Testing

```bash
node test/index.js --from "you@domain.com" --to "someone@domain.com"
```
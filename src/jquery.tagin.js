/*
* jQuery Tagin
*
* @version v0.5 (02/2012)
*
* Copyright (C) 2011, Jakub Dundalek
* Released under the MIT license.
*
* Homepage:
*   http://dundalek.com/jquery-tagin/
*
* Source code:
*   http://github.com/dundalek/jquery-tagin
*
* Dependencies:
*   jQuery v1.7+
*   jQuery UI v1.8+
*/

(function($) {

var TagComponent = function(element, options) {
    this.element = element;
    this.options = options;
    this._create();
};

TagComponent.prototype = {
    options: {
        // tag delimiter
        delimiter: ' ',

        // create new tag when delimiter key is pressed
        delimiterCreateTag: true,

        // if false only tags can be inserted
        allowTextInput: false,

        // if false only tags from autocomplete can be inserted
        allowNewTags: true,

        // allowed characters of tag (no restrictions by default)
        // example for alphanumeric values: /[-a-zA-Z0-9]/g
        allowedChars: null,

        // function for transforming tag value, it can be:
        // - name of String method (like 'toLowerCase' 'toUpperCase')
        // - or regular function
        transformFunction: null,

        // array of tags for autocomplete
        availableTags: null,

        // function for autocomplete tagSource(term, callback)
        tagSource: null,

        // options for autocomplete
        // see http://jqueryui.com/demos/autocomplete/#options
        autocomplete: {
            autoFocus: true
        },

        // do animation when removing tag
        animate: true
    },

    _create: function() {
        if (!this.options.tagSource && this.options.availableTags) {
            this.options.tagSource = this._createTagSourceFunction();
        }

        var tagInput = new TagInput(this);
        tagInput.tagElement.hide();
        this.items = [tagInput];

        this.origElement = this.element;
        this.origElement.hide();

        this.element = $('<ul>')
            .addClass('tagin ui-widget ui-widget-content ui-corner-all')
            .append(tagInput.el2)
            .insertAfter(this.origElement);
        tagInput._createWidthTester();

        // set initial tags if they are present in input
        var tags = $(this.origElement).val().split(this.options.delimiter);
        this.tags(tags);

        var that = this;

        // focus input when container element is clicked
        this.element.click(function(event) {
            if (!$(event.target).is('input')) {
                that.focus();
            }
        });

        this.origElement.on('change', function() {
            // set tags to original element so that form submission works
            that.origElement.attr('value', that.tags().join(that.options.delimiter));
        });
    },

    // creates function that performs search in available tags
    _createTagSourceFunction: function() {
        var that = this;
        return function(search, showChoices) {
            var term = $.trim(that._extractLastTerm(search.term)[1]);
            if (term === '') {
                showChoices(null);
                return;
            }
            var filter = term.toLowerCase();
            var choices = $.grep(that.options.availableTags, function(element) {
                // Only match autocomplete options that begin with the search term.
                // (Case insensitive.)
                return element.toLowerCase().indexOf(filter) === 0;
            });
            showChoices(subtractArray(choices, that.tags()));
        };
    },

    createTag: function(val, tagInput) {
        // apply transformation function
        val = this._transformTag($.trim(val));

        // if the value is empty or already present we do not add it
        if (val === '' || subtractArray([val], this.tags()).length === 0) {
            return false;
        }

        var idx;
        if (tagInput instanceof TagInput) {
            idx = $.inArray(tagInput, this.items);
        } else if (typeof(tagInput) === 'number') {
            idx = tagInput;
        } else {
            idx = this.items.length-1;
        }

        var item = new TagInput(this);
        item.tag(val);

        var el = this.items[idx].el2;
        el.after(item.el2)
        el.after(item.el1);

        this.items.splice(idx+1, 0, item);
        item._createWidthTester();

        if (tagInput instanceof TagInput) {
            var term = this._extractLastTerm(tagInput.input());
            tagInput.input(term[0]);
            this._switchFocus(item);
        }
        this.trigger('tag-created', val);
        this.trigger('change');

        return true;
    },

    removeTag: function(item, offset) {
        var idx = -1;
        offset = offset || 0;

        // handle parameters and determine which tag to remove
        if (typeof(item) === 'number') {
            idx = 1+item;
        } if (typeof(item) === 'string') {
            idx = $.inArray(item, this.tags())+1;
        } else if (item instanceof TagInput) {
            idx = $.inArray(item, this.items);
            this._switchFocus(item, offset-1);
        }
        idx += offset;

        if (!(idx > 0 && idx < this.items.length)) {
            return;
        }
        item = this.items[idx];
        this.items.splice(idx, 1);

        // merge contents of deleted input
        if (this.options.allowTextInput && item.input() !== '' && idx-1 >= 0) {
            var itemVal = this.items[idx-1].input(),
                position = itemVal.length;
            itemVal += item.input();
            itemVal = itemVal.replace(/\s+$/, '');
            this.items[idx-1].input(itemVal);
            setCaretPosition(this.items[idx-1].inputElement[0], position);
        }

        this.trigger('tag-removed');
        this.trigger('change');

        var removeFn = function() {
            item.el1.remove();
            item.el2.remove();
        };

        if (this.options.animate) {
            // animate removal
            item.el1.fadeOut('fast').hide('blind', {direction: 'horizontal'}, 'fast', removeFn).dequeue();
        } else {
            removeFn();
        }
    },

    tags: function(val, tagInput) {
        if (val === undefined) { // getter
            return $.map(this.items.slice(1), function(x) {return x.tag();});
        } else if (val instanceof Array) { // setter
            if (!tagInput) {
                this.clear();
            }

            var offset = 0,
                idx = $.inArray(tagInput, this.items);
            idx = idx !== -1 ? idx : this.items.length-1;

            for (var i = 0, len = val.length; i < len; i++) {
                offset += this.createTag(val[i], idx+offset) ? 1 : 0;
            }

            if (tagInput) {
                this._switchFocus(tagInput, offset);
            }
        }
    },

    inputs: function(val) {
        if (val === undefined) { // getter
            return $.map(this.items, function(x) {return x.input();});
        } else { //setter
            var i, value;
            for (i = 0; i < this.items.length-1; i++) {
                value = i < val.length ? val[i] : '';
                this.items[i].input(value);
            }
            // truncate the rest of inputs if too many given
            this.items[i].input(val.slice(i).join(''));
        }
    },

    clear: function() {
        // clear all tags and inputs
        this.element.children(':gt(0)').remove();
        var item = this.items[0];
        this.items = [item];
        if (item.input() !== '') {
            item.input(''); // triggers change
        } else {
            this.trigger('change');
        }
    },

    blur: function() {
        $.each(this.items, function() {
            this.inputElement.trigger('blur');
        });
    },

    focus: function() {
        // focus the last input
        this.items[this.items.length-1].inputElement.focus();
    },

    trigger: function(event) {
        this.origElement.triggerHandler(event);
    },

    _switchFocus: function(item, offset) {
        var idx = $.inArray(item, this.items);
        idx = idx !== -1 ? idx : 0;
        idx += offset || 0;
        if (idx >= 0 && idx < this.items.length) {
            var elm = this.items[idx].inputElement;
            item.inputElement.trigger('blur', true);
            elm.trigger('focus', true);
            setCaretPosition(elm[0], offset <= 0 ? elm.val().length : 0);
        }
    },

    // extract last item from input for example for autocomplete
    _extractLastTerm: function(val) {
        var idx = val.lastIndexOf(this.options.delimiter)+1;
        return [val.substring(0, idx), val.substring(idx)];
    },

    _transformTag: function(val) {
        var fn = this.options.transformFunction;
        if (fn) {
            if (typeof(fn) === 'string' && val[fn]) {
                val = val[fn]();
            } else if (typeof(fn) === 'function') {
                val = String(fn(val));
            }
        }
        return val;
    }
};

var TagInput = function(component, options) {
    this.component = component;
    this._create();
};

TagInput.prototype = {
    minWidth: 4,
    _create: function() {
        var that = this;
        // create tag
        var removeTag = $('<a><span class="text-icon">\xd7</span></a>') // \xd7 is X
            .addClass('tagin-close')
            .append($('<span class="ui-icon ui-icon-close">'))
            .click(function(event) {that.onClickRemove(event)});

        var tagLabel = $('<span class="tagin-label"></span>')
        var tagElement = $('<li>')
            .addClass('tagin-tag ui-widget-content ui-state-default ui-corner-all');
        tagElement
            .append(tagLabel);
        tagElement
            .append(removeTag);

        this.tagLabelElement = tagLabel;
        this.tagElement = tagElement;

        // create input
        this._input = '';
        this.inputElement = $('<input>', {type: 'text', 'class': 'ui-widget-content'});
        this.inputElement.width(this.minWidth);

        // add it to element
//         this.element
//             .append(this.tagElement)
//             .append(this.inputElement);

        this.el1 = this.tagElement;
        this.el2 = $('<li class="tagin-input">').append(this.inputElement);

        // register autocomplete
        if (this.component.options.tagSource) {
            this.inputElement.autocomplete($.extend(this.component.options.autocomplete, {
                source: this.component.options.tagSource
            })).on('autocompleteselect', function(event, ui) {
                that.component.createTag(ui.item.value, that);
                that.onChange();

                // Preventing the tag input to be updated with the chosen value.
                return false;
            }).on('autocompletefocus', function() {
                // prevent value inserted when browsing items
                return false;
            });
        }

        // register events
        this.inputElement
            .on('keydown', function(event) {
                that.onKeydown(event);
                that.onChange(event);
            })
            .on('keyup keypress blur focus change', function(event, explicit) {that.onChange(event, explicit)});
    },

    _createWidthTester: function() {
        // needs to be called after tag input is inserted to DOM
        this.widthTester = $('<div>').insertAfter(this.inputElement);
        this._setWidthTesterStyle(this.widthTester);
        this.widthTesterVal = '';
    },

    _setWidthTesterStyle: function(el) {
        var input = this.inputElement;
        return el.css({
            opacity: 0,
            outline: 0,
            position: 'absolute',
            top: -9999,
            left: -9999,
            width: 'auto',
            fontSize: input.css('fontSize'),
            fontFamily: input.css('fontFamily'),
            fontWeight: input.css('fontWeight'),
            letterSpacing: input.css('letterSpacing'),
            whiteSpace: 'nowrap',
            // IE has some troubles with 'padding'
            //padding: input.css('padding')
            'padding-top': input.css('padding-top'),
            'padding-right': input.css('padding-right'),
            'padding-bottom': input.css('padding-bottom'),
            'padding-left': input.css('padding-left')
        });
    },

    tag: function(val) {
        if (val === undefined) { // getter
            return this._tag;
        } else { // setter
            this._tag = val;
            this.tagLabelElement.text(val);
            return this;
        }
    },

    input: function(val) {
        if (val === undefined) { // getter
            return this.inputElement.val();
        } else { // setter
            this.inputElement.val(val);
            this.onChange();
            return this;
        }
    },

    onClickRemove: function(event) {
        this.component.removeTag(this);
    },

    onKeydown: function(event) {
        var position;
        switch(event.which) {
            case $.ui.keyCode.TAB:
                event.preventDefault();
                if (this.component.options.allowNewTags) {
                    this.inputElement.autocomplete('close');
                    var term = this.component._extractLastTerm(this.inputElement.val());
                    this.component.createTag(term[1], this);
                }
                break;
            case $.ui.keyCode.LEFT:
                position = getCaretPosition(this.inputElement[0]);
                if (position == 0) {
                    event.preventDefault();
                    this.component._switchFocus(this, -1);
                }
                break;
            case $.ui.keyCode.RIGHT:
                position = getCaretPosition(this.inputElement[0]);
                if (position >= this.inputElement.val().length) {
                    event.preventDefault();
                    this.component._switchFocus(this, 1);
                }
                break;
            case $.ui.keyCode.BACKSPACE:
                position = getCaretPosition(this.inputElement[0]);
                if (position == 0) {
                    event.preventDefault();
                    this.component.removeTag(this, 0);
                }
                break;
            case $.ui.keyCode.DELETE:
                position = getCaretPosition(this.inputElement[0]);
                if (position >= this.inputElement.val().length) {
                    event.preventDefault();
                    this.component.removeTag(this, 1);
                }
                break;
        }
    },

    onChange: function(event, explicit) {
        var input = this.inputElement;
        event = event || {};

        // blur event and no allowTextInput - remove text from input
        if (event.type === 'blur' && !this.component.options.allowTextInput) {
            input.val('');
        }

        // handle chacarters that are not allowed
        if (this.component.options.allowedChars instanceof RegExp) {
            // do not insert character when key is pressed
            if (event.type && event.type === 'keypress'
                && printable(event) && !String.fromCharCode(event.which).match(this.component.options.allowedChars)) {
                event.preventDefault();
            }
            // filter input (for example when copy&pasted)
            var val = input.val().match(this.component.options.allowedChars);
            if (val && (val = val.join('')) !== input.val()) {
                input.val(val);
            }
        }

        // create tags from input (delimiter key pressed or copy&paste containing delimiter characters)
        if (this.component.options.delimiterCreateTag
            && this.component.options.allowNewTags)
        {
            var splits = input.val().split(this.component.options.delimiter);
            if (splits.length > 1) {
                input.val('');
                this.component.tags(splits, this);
            }
        }

        // input changed - trigger change
        if (this.component.options.allowTextInput && this._input !== (this._input = input.val())) {
            this.component.trigger('change');
        }
        // pass events to main component
        if (!explicit && event.type && event.type !== 'change') {
            this.component.trigger(event);
        }

        this._autoresize(event);
    },

    _autoresize: function(event) {
        // Auto resize input
        // http://stackoverflow.com/questions/1288297/jquery-auto-size-text-input-not-textarea
        var input = this.inputElement,
            val = input.val();

        // little hack, otherwise autoresize does weird bumping
        if (event.type && event.type !== 'keyup' && !event.isDefaultPrevented() && printable(event)) {
            val += String.fromCharCode(event.which);
        }

        // autoresize input based on value
        if (this.widthTester && this.widthTesterVal !== (this.widthTesterVal = val)) {
            // Enter new content into widthTester
            var escaped = val.replace(/&/g, '&amp;').replace(/\s/g,'&nbsp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            this.widthTester.html(escaped);

            // Calculate new width + whether to change
            var testerWidth = this.widthTester.width()+this.minWidth;

            input.width(testerWidth);
        }
    }
};

// subtract two arrays of string, ignore case
var subtractArray = function(a1, a2) {
    a2 = $.map(a2, function(x) {return x.toLowerCase();});
    return jQuery.grep(a1, function (item) {
        return jQuery.inArray(item.toLowerCase(), a2) < 0;
    });
};

// Check a key from an event and match it against any known characters.
// The `keyCode` is different depending on the event type: `keydown` vs. `keypress`.
//
// These were determined by looping through every `keyCode` and `charCode` that
// resulted from `keydown` and `keypress` events and counting what was printable.
var printable = function(e) {
    var code = e.which;
    if (e.type == 'keydown') {
        if (code == 32 ||                      // space
            (code >= 48 && code <= 90) ||      // 0-1a-z
            (code >= 96 && code <= 111) ||     // 0-9+-/*.
            (code >= 186 && code <= 192) ||    // ;=,-./^
            (code >= 219 && code <= 222)) {    // (\)'
        return true;
        }
    } else {
        // [space]!"#$%&'()*+,-.0-9:;<=>?@A-Z[\]^_`a-z{|} and unicode characters
        if ((code >= 32 && code <= 126)  ||
            (code >= 160 && code <= 500) ||
            (String.fromCharCode(code) == ":")) {
        return true;
        }
    }
    return false;
};

function getCaretPosition(ctrl) {
    var CaretPos = 0;   // IE Support
    if (document.selection) {
        ctrl.focus ();
        var Sel = document.selection.createRange ();
        Sel.moveStart ('character', -ctrl.value.length);
        CaretPos = Sel.text.length;
    }
    // Firefox support
    else if (ctrl.selectionStart || ctrl.selectionStart == '0') {
        CaretPos = ctrl.selectionStart;
    }
    return (CaretPos);
}

function setCaretPosition(ctrl, pos) {
    if (ctrl.setSelectionRange) {
        ctrl.focus();
        ctrl.setSelectionRange(pos,pos);
    } else if (ctrl.createTextRange) {
        var range = ctrl.createTextRange();
        range.collapse(true);
        range.moveEnd('character', pos);
        range.moveStart('character', pos);
        range.select();
    }
}

$.widget('ui.tagin', TagComponent.prototype);

})(jQuery);
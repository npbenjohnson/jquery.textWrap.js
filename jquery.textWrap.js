// Examples and license at https://github.com/npbenjohnson/jquery.textWrap.js

jQuery.fn.extend({
    textWrap: function (options, force) {
        var wrapper = this.data('tw.wrapper');

        if (options === false) {
            if (wrapper) {
                wrapper.destroy();
                $this.data('tw.wrapper', null);
            }
            return this;
        }

        if ((options === null || options === undefined) && wrapper) {
            wrapper.wrap(force);
            return this;
        }

        var settings = $.extend(new TextWrapper.prototype.TextWrapperSettings(), options);

        // Destroy old
        if (wrapper)
            wrapper.destroy();
        // Remove old events
        this.off('twRemoved');

        // create new
        this.data('tw.wrapper', new TextWrapper(this[0], settings));

        // dispose on removal handler
        if (settings.handleResize && (!settings.width ||
        (settings.width.lastIndexOf && settings.width.lastIndexOf('%') !== -1))) {
            if (!$.event.special.twRemoved)
                $.event.special.twRemoved = {
                    remove: function (o) {
                        if (o.handler)
                            o.handler(o);
                    }
                };
            this.on('twRemoved', this, function (evt) {
                evt.data.textWrap(false);
                evt.data.off('twRemoved');
            });
        }
    }
});

TextWrapper.prototype.TextWrapperSettings = function TextWrapperSettings() {
    // Width to wrap to (% or px)
    this.width = '100%';
    // number = number of lines 0 = infinite %= number of lines that fit in % height
    this.maxLines = 0;
    this.overflow = 'elipse';
    // Recalculate on window.resize (will only be used if % width)
    this.handleResize = true;
    // Character count which must stay on the line for a word to break
    this.minWordWrapPrefix = 6;
    // CSS classes for wrap elements
    this.breakClass = 'tw.b';
    this.hiddenClass = 'tw.h';
    this.suffixClass = 'tw.s';
    this.textMeasureClass = 'tw.m';
    // must have stylesheet if this is false
    this.useInlineStyles = true;
    this.useRangeIfAvailable = true;
}
new TextWrapper.prototype.TextWrapperSettings();

TextWrapper.prototype.TextWrapperModel = function TextWrapperModel(element, settings) {
    if (!settings)
        settings = new TextWrapper.prototype.TextWrapperSettings();
    this.settings = settings;
    this.element = element;
    this.splitNode = null;
    this.elementBounds = null;
    this.children = [];
    this.splitIndex = 0;
    this.hideWrappers = [];
    this.textWrappers = [];
    this.isRefresh = false;
    this.usesRange = Range !== null && Range !== undefined && settings.useRangeIfAvailable;
    this.breaks = 0;
    this.lastBreakIndex = 0;
    this.suffix = null;
    this.suffixBounds = null;
    this.staticWidthStack = [0];
    this.staticWidth = 0;
}

function TextWrapper(element, settings) {
    // Reset model for a new wrap
    function resetModel(state) {
        state.splitNode = state.suffix = state.suffixBounds = null;
        state.splitIndex = state.breaks = state.lastBreakIndex = state.staticWidth = 0;
        state.staticWidthStack = [0];
    }
    this._resetModel = resetModel;

    // Perform a wrap
    function wrap(state, forceRefresh) {
        if (!refreshBounds(state, forceRefresh)) return; // No change in size
        removeWrap(state); // Clear previous formatting
        state.children = flattenElementTree(state.element);
        if (state.children.length === 0) return; // Exit if no children to wrap
        resetModel(state);// Reset wrapping controls
        // Break lines
        breakWrapPoints(state);
        if (state.splitIndex !== state.children.length && state.settings.maxLines > 0)
            hideLevels(state); // Hide overflow
        if (state.textWrappers.length > 0)
            state.textWrappers.forEach(unwrapInner); //Destroy text wrappers
        if (state.suffix) deleteNode(state.suffix);
        state.suffixBounds = state.suffix = null; // Clear unneeded objects
    }
    this.wrap = function (force) { wrap(this.model, force); }

    // Get new bounds, return true if refresh required
    function refreshBounds(state, forceRefresh) {
        var ol = state.elementBounds.getInnerLeft(),
            or = state.elementBounds.getInnerRight();
        state.elementBounds.resetRect();
        return forceRefresh || or !== state.elementBounds.getInnerRight() ||
            ol !== state.elementBounds.getInnerLeft();
    }
    this._refreshBounds = refreshBounds;

    // Find Next breakpoint for wrapping
    function breakWrapPoints(state) {
        var prevNode, node, checkBounds;
        while ((state.settings.maxLines <= 0 || state.settings.maxLines > state.breaks) &&
            state.splitIndex < state.children.length) {
            prevNode = node; // store for compare
            node = state.splitNode = state.children[state.splitIndex]; // move to next node

            updateStaticWidthStack(state, prevNode);
            checkBounds = setNodeBounds(state);

            if (node.node.nodeType === 3 && state.settings.maxLines > 0) // Check elipse if this is the last line
                if (requireElipse(state, node.node.data, node.node.data.length))
                    checkbounds = state.suffixBounds;

            var pxOverlap = state.staticWidth +
                checkBounds.getOuterRight() - state.elementBounds.getInnerRight();

            if (!tryBreakLine(state, pxOverlap))
                break;
        }
    }
    this._breakWrapPoints = breakWrapPoints;

    function tryBreakLine(state, pxOverlap) {
        if (pxOverlap >= 0)  // Node overlaps
            if (state.splitNode.node.nodeType === 3) { // Node is text
                return initTextWrap(state, pxOverlap); // false means 1 char doesn't fit, stop trying to wrap
            }
            else if (state.splitNode.node.childNodes.length === 0 ||
                    state.splitNode.bounds.getInnerWidth() < pxOverlap) {
                // Single item too big to break
                breakLine(state, state.splitNode.node);// Drop to own line
                state.splitIndex++;
            }
            else
                state.splitIndex++; // Move to check children
        else
            moveToNextLevelNode(state); // no collision, skip children
        return true;
    }

    function setNodeBounds(state) {
        var node = state.splitNode;
        if (node.node.nodeType === 3) // node is text
            node.bounds = state.usesRange ? createRangeBounds(node.node) :
                createTextBounds(state);
        else
            node.bounds = new ElementBounds(node.node); // Node isn't text
        return node.bounds;
    }

    function updateStaticWidthStack(state, previousNode) {
        if (previousNode) // if there was a node before this
            if (previousNode.level < state.splitNode.level) { // if the new node is lower in the tree
                state.staticWidthStack.push(state.staticWidth); // track new static width amount
                state.staticWidth = previousNode.bounds.getPaddingRight() +
                    previousNode.bounds.getBorderRight() + state.staticWidth;
            }
            else if (previousNode.level > state.splitNode.level) // new node is higher in the tree
                for (var i = 0; i < previousNode.level - state.splitNode.level; i++)
                    state.staticWidth = state.staticWidthStack.pop();// pop a width per lvl
    }

    function createRangeBounds(node) {
        var range;
        if (!(range = TextWrapper.prototype.range))
            range = TextWrapper.prototype.range = document.createRange();
        range.selectNode(node);
        return new ElementBounds(range);
    }

    function createTextBounds(state) {
        var wrapper = wrapTextForSize(state.splitNode.node);
        state.textWrappers.push(wrapper);
        return new ElementBounds(wrapper);
    }

    // Make initial guess of text size, try to error on the high side so it can be verified by moving
    // down to correct size
    function initTextWrap(state, pxOverlap) {
        var node = state.splitNode;
        var originalText = node.node.data;
        var pxPerChar = node.bounds.getInnerWidth() / originalText.trim().length;
        var guessCharLength = Math.max(0, originalText.length - Math.ceil(pxOverlap / pxPerChar - state.staticWidth / pxPerChar));
        var newText = rTrim(originalText.slice(0, guessCharLength));
        if (requireElipse(state, originalText, guessCharLength))
            newText = getElipseText(state,
                { text: newText, guessLength: guessCharLength, suffix: false, originalText: originalText });
        else
            newText = getClosestBreakPointText(state,
                { text: newText, guessLength: guessCharLength, suffix: false, originalText: originalText });
        node.node.data = newText.text;
        node.bounds.resetRect();
        return splitTextPoint(state, newText);
    }
    this._initTextWrap = initTextWrap;

    // Get the closest breakable character for a given guess
    function getClosestBreakPointText(state, lastGuess) {
        if (lastGuess.guessLength >= lastGuess.originalText.length || endsWithSpace(lastGuess.text))
            return lastGuess; // Current guess breaks on whitespace
        return getNextBreakPointText(state, lastGuess, true);
    }

    function requireElipse(state, originalText, guessLength) {
        var isLastLine = state.breaks === state.settings.maxLines - 1;
        var required = isLastLine &&
        // this isn't the last node
        (!(state.splitIndex === state.children.length - 1) ||
        // and last char to process
        (guessLength < rTrim(originalText).length));
        if (required)
            addSuffix(state, '…');
        else if (isLastLine)
            hideNode(state.suffix);
        return required;
    }

    function getElipseText(state, lastGuess, getLonger) {
        if (lastGuess.suffix === false) addSuffix(state, '…');
        lastGuess.suffix = true;
        var originalText = lastGuess.originalText;
        if (getLonger) {
            while (endsWithSpace(originalText[lastGuess.guessLength - 1]) && lastGuess.guessLength < originalText.length) lastGuess.guessLength++;
            lastGuess.text = rTrim(originalText.slice(0, lastGuess.guessLength));
        }
        else {
            lastGuess.guessLength -= 2;
            while (endsWithSpace(originalText[lastGuess.guessLength - 1]) && lastGuess.guessLength > 0) lastGuess.guessLength--;
            lastGuess.text = rTrim(originalText.slice(0, Math.max(0, lastGuess.guessLength)));
        };
        return lastGuess;
    }

    function getNextBreakPointText(state, lastGuess, getLonger) {
        var nextPossibleSpace,
                forceBreak = state.splitIndex === state.lastBreakIndex,
                minPrefix = state.settings.minWordWrapPrefix,
                isWordBreak, originalText = lastGuess.originalText;
        if (requireElipse(state, lastGuess.guessLength))
            return getElipseText(state, lastGuess, getLonger);
        if (getLonger) {
            nextPossibleSpace = originalText.indexOf(' ', lastGuess.guessLength);
            if (nextPossibleSpace === -1) nextPossibleSpace = originalText.length - 1;

            // No word break allowed or Last valid space isn't atleast minPrefix characters away
            if (minPrefix < 1 || (nextPossibleSpace + 1) - lastGuess.guessLength < minPrefix) { // break on space
                isWordBreak = false;
                lastGuess.guessLength = nextPossibleSpace + 1;
                lastGuess.text = originalText.slice(0, lastGuess.guessLength);
            }
            else { // break in word
                isWordBreak = true;
                lastGuess.guessLength += minPrefix;
                lastGuess.text = originalText.slice(0, lastGuess.guessLength);
            }
        }
        else {
            nextPossibleSpace = Math.max(0, originalText.lastIndexOf(' ', lastGuess.guessLength - 2));
            if (forceBreak && nextPossibleSpace === 0)
                minPrefix = 1; // There must be a break in this node, unlock word breaking
            // No word break allowed or Last valid space isn't atleast minPrefix characters away
            if (minPrefix < 1 || lastGuess.guessLength - (nextPossibleSpace + 1) < minPrefix) {
                isWordBreak = false;
                lastGuess.guessLength = nextPossibleSpace;
                lastGuess.text = originalText.slice(0, nextPossibleSpace);
                if (lastGuess.suffix === true)
                    hideNode(state.suffix);
            }
            else {
                isWordBreak = true;
                lastGuess.guessLength -= 1;
                lastGuess.text = originalText.slice(0, lastGuess.guessLength);
            }

            if (isWordBreak) {
                if (!lastGuess.suffix) // show suffix
                    addSuffix(state, '-');
                else if (lastGuess.suffix === 'hidden')
                    showNode(state.suffix);
                lastGuess.suffix = true;
            }
            else {
                if (lastGuess.suffix === true) hideNode(state.suffix); // Hide suffix
            }
        }
        return lastGuess;
    }

    function breakLine(state) {
        if (state.settings.maxLines === 0 || state.settings.maxLines > state.breaks) {
            var node = state.children[state.splitIndex].node;
            insertNewElement('br', state.settings.breakClass, null, node, node.parentNode);
            state.breaks++;
            state.lastBreakIndex = state.splitIndex;
        }
    }

    // Split a text node where the line should be broken
    function splitTextPoint(state, firstGuess) {
        var node = state.splitNode,
            currentGuess = firstGuess,
            prevGuess,
            currentBounds = firstGuess.suffix === true ?
            state.suffixBounds : node.bounds, // Use suffix bounds if present
            makeLonger = currentBounds.getOuterRight()
            + state.staticWidth < state.elementBounds.getInnerRight(); // true if correctly broken text is longer
        do {
            if (makeLonger) // clone previous guess so it can be reused when correct length is found
                prevGuess = {
                    text: currentGuess.text, suffix: currentGuess.suffix,
                    guessLength: currentGuess.guessLength
                };
            currentGuess = getNextBreakPointText(state, currentGuess, makeLonger); // get next guess
            state.splitNode.node.data = rTrim(currentGuess.text); // apply next guess
            currentBounds = currentGuess.suffix === true ? state.suffixBounds : node.bounds;
            currentBounds.resetRect();
        }
        while ((makeLonger && currentBounds.getOuterRight() + state.staticWidth < state.elementBounds.getInnerRight() && currentGuess.text.length < originalText.length)
            || (!makeLonger && currentBounds.getOuterRight() + state.staticWidth >= state.elementBounds.getInnerRight() && currentGuess.text.length > 0));
        if (makeLonger) {
            if (prevGuess.suffix !== currentGuess.suffix) {
                if (prevGuess.suffix === true)
                    showNode(state.suffix);
                if (prevGuess.suffix === false || prevGuess.suffix === 'hidden')
                    hideNode(state.suffix);
            }
            currentGuess = prevGuess;
            state.splitNode.node.data = rTrim(currentGuess.text);
        }
        if (currentGuess.text.length === 0) {
            if (currentGuess.suffix === true) {
                state.suffix.parentNode.insertBefore(state.suffix, state.suffix.previousSibling);
                state.suffix = null;
            }
            if (state.lastBreakIndex === state.splitIndex)
                return false; // no characters can fit on new line, exit;
            state.splitNode.node.data = firstGuess.originalText;
            breakLine(state);
        }
        else {
            var newTextNode = document.createTextNode(rTrim(firstGuess.originalText.slice(currentGuess.text.length)));
            if (currentGuess.suffix === true) {
                state.suffix.parentNode.insertBefore(newTextNode, state.suffix.nextSibling);
                state.suffix = null;
            }
            else
                insertAfterText(state.splitNode.node, newTextNode, state.usesRange);

            state.children.splice(state.splitIndex + 1, 0, { node: newTextNode, level: state.splitNode.level });
            state.splitIndex++; // move forward to new node
            breakLine(state, newTextNode);
        }
        return true;
    }
    this._splitTextPoint = splitTextPoint;

    // Wrap text node in clone used to check size
    function wrapTextForSize(state) {
        var node = state.splitNode;
        var parent = node.parentNode;
        var clone = parent.cloneNode();
        if (state.settings.useInlineStyles)
            clone.style.cssText =
                'position:static;visibility:visible;overflow:visible;white-space:nowrap;top:auto;left:auto;right:auto;bottom:auto;width:auto;height:auto;display:inline;border-width:0;padding:0;margin:0';
        clone.className = state.settings.textMeasureClass;
        // Put hidden size test clone in document
        parent.insertBefore(clone, node).insertBefore(node);
        return clone;
    }
    this._wrapTextForSize = wrapTextForSize;

    function moveToNextLevelNode(state) {
        var current = state.children[++state.splitIndex], level = state.splitNode.level;
        while (current && current.level > level) {
            state.splitIndex++;
            current = state.children[state.splitIndex + 1]
        }
        if (!current) state.splitIndex++;
    }

    function moveToLastLevelNode(state) {
        var current = state.children[state.splitIndex + 1], level = state.splitNode.level;
        while (current && current.level >= level) {
            state.splitIndex++;
            current = state.children[state.splitIndex + 1];
        }
    }
    this._moveToLastLevelNode = moveToLastLevelNode;

    function hideLevels(state) {
        // Start at current split node
        var firstNode, wrapper;
        // process until no more nodes
        while (firstNode = state.children[state.splitIndex]) {
            // try to get existingwrapper
            if (wrapper = state.hideWrappers[firstNode.level])
                if (wrapper.firstChild === firstNode.node)
                    break; // break if already wrapped
                else
                    unwrapInner(wrapper);
            moveToLastLevelNode(state)
            hideNodes(state, firstNode, state.children[state.splitIndex]);
            state.splitIndex++;
        }
    }
    this._hideLevels = hideLevels;

    function hideNodes(state, firstNode, endNode) {
        // create hide span
        var hideSpan = document.createElement('span');
        hideSpan.className = state.settings.hiddenClass;
        if (state.settings.useInlineStyles)
            hideSpan.style.cssText = 'display:none';

        var current = firstNode.node;
        var next;
        var parent = firstNode.node.parentNode;
        var endNext = endNode.nextSibling;
        do {
            next = current.nextSibling;
            hideSpan.insertBefore(current);
        } while (current !== endNode.node && (current = next))
        parent.insertBefore(hideSpan, endNext);
        state.hideWrappers[firstNode.level] = hideSpan;
    }
    this._hideNodes = hideNodes;

    // Order by a depth first type pattern
    function flattenElementTree(element) {
        var tree = [],
            parentStack = [],
            current = element.firstChild,
            scanDown = true,
            normalizeNode = null,
            lvl = 0;
        while (current != null) { // scan until all nodes processed
            while (current && scanDown) { // scan as deep as possible
                parentStack.push(current); // push each node onto parent stack
                if (current.nodeType === 3) // normalize and clean
                {
                    while (current.nextSibling && current.nextSibling.nodeType === 3) {
                        current.data += current.nextSibling.data;
                        deleteNode(current.nextSibling);
                    }
                    current.data = current.data.replace(/[\t\n\r ]+/g, ' ')
                }
                tree.push({ node: current, level: lvl }); // Store in tree
                lvl++; // move down a level
                scanDown = (current = current.firstChild) !== null; // set scan down according to children
            }

            do {
                // pop a node off the parent stack and move up to its level
                // until it has a sibling
                current = parentStack.pop();
                lvl--;
            } while (!current.nextSibling && parentStack.length > 0)
            current = current.nextSibling; // Move forward and search deep again
            scanDown = true;
        }
        return tree;
    };
    this._flattenElementTree = flattenElementTree;

    // Create or unhide / move a suffix
    function addSuffix(state, text) {
        var node = state.splitNode.node;
        if (state.suffix === null) { // create new suffix
            state.suffix = insertNewElement('span', state.settings.suffixClass, text);
            state.suffixBounds = new ElementBounds(state.suffix);
        }
        else
            state.suffix.innerHTML = text;

        insertAfterText(state.splitNode.node, state.suffix, state.usesRange);
        showNode(state.suffix);
    }


    function removeBreaks(element, breakClass, suffixClass) {
        var breaks = element.getElementsByTagName('br');
        var current;
        for (var i = breaks.length - 1; i >= 0; i--) {
            current = breaks[i];
            var classes = current.className.split(' ');
            if (classes.indexOf(breakClass) !== -1) {
                var s = current.previousSibling;
                if (s && s.className && s.className.split(' ').indexOf(suffixClass) !== -1)
                    // remove suffix
                    deleteNode(current.previousSibling);
                else
                    // untrim
                    if (current.previousSibling && current.previousSibling.data) current.previousSibling.data += ' ';
                // remove break
                deleteNode(current);
            }
        }
    }
    this._removeBreaks = removeBreaks;

    function removeWrap(state) {
        if (state.isRefresh) {
            state.hideWrappers.forEach(unwrapInner);
            state.hideWrappers = [];
        }
        else
            removeSpans(state.element, state.settings.hiddenClass, true);

        removeBreaks(state.element, state.settings.breakClass);
        removeSpans(state.element, state.settings.suffixClass, false);
    }
    this._removeWrap = removeWrap;

    function ElementBounds(element, innerWidthSetting) {
        var boundingRect,
            marginRight,
            paddingRight,
            borderRight,
            marginLeft,
            paddingLeft,
            borderLeft,
            innerWidthRatio = 1,
            staticInnerWidth,
            style = window.getComputedStyle(element, null);

        if (innerWidthSetting) {
            if (innerWidthSetting.lastIndexOf && innerWidthSetting.lastIndexOf('%') !== -1)
                innerWidthRatio = parseInt(innerWidthSetting) / 100;
            else
                staticInnerWidth = parseInt(innerWidthSetting);
        }

        // quit early if wrong position type
        if (style) {
            var position = style.getPropertyValue('position');
            if (position === 'relative' || position === 'absolute' || position === 'fixed')
                return null; // text wrap has no use for these
        }

        //#region Private Functions
        function getViewX() {
            if (window.pageXOffset !== undefined)
                return window.pageXOffset;
            return (((t = document.documentElement) || (t = document.body.parentNode)) && typeof t.ScrollLeft == 'number' ? t : document.body).ScrollLeft;
        }

        function getViewY() {
            if (window.pageYOffset !== undefined)
                return window.pageYOffset;
            return (((t = document.documentElement) || (t = document.body.parentNode)) && typeof t.ScrollTop == 'number' ? t : document.body).ScrollTop;
        }
        //#endregion 

        // Reset the bounding rectangle so it can be reloaded
        this.resetRect = function () {
            boundingRect = undefined;
        };

        this.getBoundingRect = function () {
            if (boundingRect === undefined) {
                boundingRect = element.getBoundingClientRect();
                var xoff = getViewX();
                var yoff = getViewY();
                boundingRect.left += xoff;
                boundingRect.right += xoff;
                boundingRect.top += yoff;
                boundingRect.bottom += yoff;
            }
            return boundingRect;
        };
        this.getInnerWidth = function () {
            if (staticInnerWidth) return staticInnerWidth;
            return innerWidthRatio * (this.getBorderWidth() -
                this.getBorderRight() - this.getBorderLeft() -
                this.getPaddingLeft() - this.getPaddingRight());
        };
        this.getBorderWidth = function () {
            return this.getBoundingRect().right - boundingRect.left;
        };
        // Does not necessarily take into account internal margin inheritance
        this.getOuterWidth = function () {
            return width = this.getBoundingRect().right - boundingRect.left + this.getMarginLeft() + this.getMarginRight();
        };
        this.getOuterLeft = function () {
            return this.getBoundingRect().left - this.getMarginLeft();
        };
        this.getOuterRight = function () {
            return this.getBoundingRect().right - this.getMarginRight();
        };
        this.getInnerLeft = function () {
            return this.getBoundingRect().left + this.getBorderLeft() + this.getPaddingLeft();
        };
        this.getInnerRight = function () {
            return this.getInnerLeft() + this.getInnerWidth();
        };
        this.getMarginRight = function () {
            return !style ? 0 : (marginRight === undefined ?
                (marginRight = parseInt(style.getPropertyValue('margin-right'))) : marginRight);
        };
        this.getMarginLeft = function () {
            return !style ? 0 : marginLeft === undefined ?
                (marginLeft = parseInt(style.getPropertyValue('margin-left'))) : marginLeft;
        };
        this.getBorderRight = function () {
            return !style ? 0 : borderRight === undefined ?
                (borderRight = parseInt(style.getPropertyValue('border-right-width'))) : borderRight;
        };
        this.getBorderLeft = function () {
            return !style ? 0 : borderLeft === undefined ?
                (borderLeft = parseInt(style.getPropertyValue('border-left-width'))) : borderLeft;
        };
        this.getPaddingRight = function () {
            return !style ? 0 : paddingRight === undefined ?
                (paddingRight = parseInt(style.getPropertyValue('padding-right'))) : paddingRight;
        };
        this.getPaddingLeft = function () {
            return !style ? 0 : paddingLeft === undefined ?
                (paddingLeft = parseInt(style.getPropertyValue('padding-left'))) : paddingLeft;
        };
    }
    this.elementBounds = ElementBounds;

    //#region Utility Dom Manipulation
    function hideNode(node) {
        var text = node.style.cssText;
        if (text.indexOf('display:none') === -1)
            node.style.cssText = 'display:none;' + text;
    }
    this._hideNode = hideNode;
    function showNode(node) {
        var text = node.style.cssText;
        if (text.indexOf('display:none') !== -1)
            node.style.cssText = text.replace('display:none', '');
    }
    this._showNode = showNode;
    function deleteNode(node) { node.parentNode.removeChild(node); }
    this._deleteNode = deleteNode;
    function unwrap(node) {
        var parent = node.parentNode;
        var nodes = parent.childNodes;
        if (parent.hasChildNodes)
            while (parent.hasChildNodes()) {
                parent.parentNode.insertBefore(parent.firstChild, parent);
            }
        parent.parentNode.removeChild(parent);
    }
    this._unwrap = unwrap;
    function unwrapInner(node) {
        if (node.firstChild) unwrap(node.firstChild);
        else deleteNode(node);
    }
    this._unwrapInner = unwrapInner;
    function removeSpans(element, spanClass, unwrap) {
        var spans = element.getElementsByTagName('span');
        var current;
        for (var i = spans.length - 1; i >= 0; i--) {
            current = spans[i];
            var classes = current.className.split(' ');
            // remove suffix
            if (classes.indexOf(spanClass) !== -1)
                if (unwrap)
                    unwrapInner(current);
                else
                    current.parentNode.removeChild(current);
        }
    }
    this._removeSpans = removeSpans;
    function insertNewElement(tagName, className, innerHTML, nextSibling, parent) {
        var node = document.createElement(tagName);
        if (className) node.className = className;
        if (innerHTML) node.innerHTML = innerHTML;
        if (parent) parent.insertBefore(node, nextSibling);
        return node;
    }
    this._insertNewElement = insertNewElement;
    function insertAfterText(textNode, insertNode, usesRange) {
        var nextSibling = usesRange ? textNode.nextSibling : textNode.parentNode.nextSibling;
        var parent = usesRange ? textNode.parentNode : textNode.parentNode.parentNode;
        parent.insertBefore(insertNode, nextSibling);
    }
    this._insertAfterText = insertAfterText;
    //#endregion
    //#region Utility string functions
    function rTrim(item) { return item.replace(/\s+$/gm, ''); }
    this._rTrim = rTrim;
    function lTrim(item) { return item.replace(/^\s+/gm, ''); }
    this._lTrim = lTrim;
    function endsWithSpace(item) { return /[\t\n\r ]$/.test(item); }
    this._endsWithSpace = endsWithSpace;
    //#endregion

    function debounce(func, wait) {
        var timeout;
        return function () {
            var context = this, args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(function () {
                timeout = null;
                func.apply(context, args);
            }, wait);
        };
    };

    function destroy() {
        if (model.handlerFunction) {
            if (window.addEventListener) {
                window.removeEventListener('resize', model.handlerFunction);
            } else if (window.attachEvent) {
                window.detachEvent('onresize', model.handlerFunction)
            }
            model.handlerFunction = null;
        }
    }
    //#region Initialize
    if (element) {
        var model = new this.TextWrapperModel(element, settings || new this.TextWrapperSettings());
        // create resize handler
        if (model.settings.handleResize && (!model.settings.width ||
            (model.settings.width.lastIndexOf && model.settings.width.lastIndexOf('%') !== -1))) {
            model.handlerFunction = debounce(function () {
                wrap(model, false);
            }, 250);

            if (window.addEventListener) {
                window.addEventListener('resize', model.handlerFunction);
            } else if (window.attachEvent) {
                window.attachEvent('onresize', model.handlerFunction);
            }
        }

        model.elementBounds = new ElementBounds(model.element, model.settings.width);
        wrap(model, true);
        model.isRefresh = true;
    }
    //#endregion
}

// Examples and license at https://github.com/npbenjohnson/jquery.textWrap.js

jQuery.fn.extend({
    // Extension adds a textwrapper with specified options targeting specified element
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

// User configurable settings
TextWrapper.prototype.TextWrapperSettings = function TextWrapperSettings() {
    // Width to wrap to (% or px)
    this.width = '100%';
    // number = number of lines 0 = infinite %= number of lines that fit in % height
    this.maxLines = 0;
    this.overflow = 'ellipsis';
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
// State tracking and settings for TextWrapper instance
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
    this.staticWidthStack = [];
    this.staticWidth = 0;
    this.hasLineLimit = settings.maxLines > 0;
}

function TextWrapper(element, settings) {

    // Perform a wrap
    function wrap(state, forceRefresh) {
        if (!isBoundsChanged(state.elementBounds, forceRefresh)) return; // No change in size
        clearFormatting(state); // Clear previous formatting
        state.children = getFlattenedChildren(state.element);
        if (state.children.length === 0) return; // Exit if no children to wrap
        resetState(state);// Reset wrapping controls
        // Break lines
        wrapLines(state);
        if (state.splitIndex !== state.children.length && state.hasLineLimit)
            hideOverflow(state);
        if (state.textWrappers.length > 0)
            state.textWrappers.forEach(unwrapInner); //Destroy text wrappers
        if (state.suffix) deleteNode(state.suffix);
        state.suffixBounds = state.suffix = null; // Clear unneeded objects
    }
    this.wrap = function (force) { wrap(this.model, force); }

    //#region State Methods
    // Reset model for a new wrap
    function resetState(state) {
        state.splitNode = state.suffix = state.suffixBounds = null;
        state.splitIndex = state.breaks = state.lastBreakIndex = state.staticWidth = 0;
        state.staticWidthStack = [];
    }
    // Wrap all lines
    function wrapLines(state) {
        var prevNode, node, checkBounds;
        while ((!state.hasLineLimit || state.settings.maxLines > state.breaks) &&
            state.splitIndex < state.children.length) {
            prevNode = node; // store for compare
            node = state.splitNode = state.children[state.splitIndex]; // move to next node

            updateStaticWidth(state, prevNode);
            checkBounds = setSplitNodeBounds(state);

            var position = checkBounds.getPosition();
            if (position !== '' && position !== 'static') // non static nodes are not wrapped
            {
                moveToNextNonChildNode(state);
                continue;
            }

            if (node.node.nodeType === 3 && state.hasLineLimit) // Check ellipsis if this is the last line
                if (isEllipsisRequired(state, node.node.data, node.node.data.length))
                    checkBounds = state.suffixBounds;

            var pxOverlap = getBoundsOverlap(state.staticWidth, checkBounds, state.elementBounds);

            if (!tryAddBreak(state, pxOverlap))
                break;
        }
    }
    // Create a linebreak and / or update splitindex
    function tryAddBreak(state, pxOverlap) {
        if (pxOverlap >= 0)  // Node overlaps
            if (state.splitNode.node.nodeType === 3) { // Node is text
                var wholeText = state.splitNode.node.data;
                // false means 1 char doesn't fit, stop trying to wrap
                return startSplitText(state, wholeText,
                    getSplitEstimate(state.splitNode.bounds.getInnerWidth(), wholeText, pxOverlap, state.staticWidth));
            }
            else if (state.splitNode.node.childNodes.length === 0 ||
                    state.splitNode.bounds.getInnerWidth() < pxOverlap) {
                // Single item too big to break
                addBreak(state);// Drop to own line
                state.splitIndex++;
            }
            else {
                state.splitIndex++; // Move to check children
                if (state.lastBreakIndex === state.splitIndex - 1) state.lastBreakIndex++;
            }
        else
            moveToNextNonChildNode(state); // no collision, skip children
        return true;
    }
    // Set the bounds property of the current splitnode
    function setSplitNodeBounds(state) {
        var node = state.splitNode;
        if (node.node.nodeType === 3) // node is text
            node.bounds = state.usesRange ? createRangeBounds(node.node) :
                createTextBounds(state); // make a wrapper or create a range to measure
        else
            node.bounds = new ElementBounds(node.node); // Node isn't text
        return node.bounds;
    }
    // Create wrapper for measuring text and add to state tracking
    function createTextBounds(state) {
        var wrapper = wrapTextForSize(state.splitNode.node, state.settings.textMeasureClass, state.useInlineStyle);
        state.textWrappers.push(wrapper);
        return new ElementBounds(wrapper);
    }
    // Update static width based on current node / previous node levels
    function updateStaticWidth(state, previousNode) {
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
    // Check if ellipsis is required, and add / hide it accordingly
    function isEllipsisRequired(state, wholeText, guessLength) {
        var isLastLine = state.breaks === state.settings.maxLines - 1;
        var required = isLastLine &&
        // this isn't the last node
        (!(state.splitIndex === state.children.length - 1) ||
        // and last char to process
        (guessLength < rTrim(wholeText).length));
        if (state.settings.overflow === 'ellipsis')
            if (required)
                addSuffix(state, '&#8230;');
            else if (isLastLine)
                hideNode(state.suffix);
        return required;
    }
    // Update state of suffix according to previous state and desired state
    function setSplitSuffix(state, guessText, wholeText, guessSuffix) {
        var isWordBreak = guessText.trim().length !== 0 &&
            guessText.length === rTrim(guessText).length &&
            guessText.length < rTrim(wholeText).length;
        if (guessSuffix === true && !isWordBreak)
            hideNode(state.suffix);
        else if (!guessSuffix && isWordBreak) // show suffix
            addSuffix(state, '-');
        else if (guessSuffix === 'hidden' && isWordBreak)
            showNode(state.suffix);
        return isWordBreak ? true : guessSuffix ? 'hidden' : null;
    }
    // Add a break before the current splitNode
    function addBreak(state) {
        if (!state.hasLineLimit || state.settings.maxLines > state.breaks) {
            var node = state.children[state.splitIndex].node;
            insertNewElement('br', state.settings.breakClass, null, node, node.parentNode);
            state.breaks++;
            state.lastBreakIndex = state.splitIndex;
        }
    }
    // Split and measure text until correct length is found
    function startSplitText(state, wholeText, guessLength) {
        var node = state.splitNode, guessText, guessSuffix, prevSuffix, prevText, checkBounds, makeLonger, ellipsis, pxOverlap;
        do {
            if (makeLonger) { prevText = guessText; prevSuffix = guessSuffix; } // Store prev for quick return if making longer
            guessSuffix = ellipsis = isEllipsisRequired(state, wholeText, guessLength); // Check for and init ellipsis
            guessText = getValidSplit(wholeText, guessLength, ellipsis ? 1 : state.settings.minWordWrapPrefix,
                state.splitIndex === state.lastBreakIndex, makeLonger === undefined ? true : makeLonger);
            if (!ellipsis) guessSuffix = setSplitSuffix(state, guessText, wholeText, guessSuffix); // Set suffix if not ellipsis
            state.splitNode.node.data = guessText; // Update node text
            (checkBounds = guessSuffix === true ? state.suffixBounds : node.bounds).resetRect();// set bounds to suffix or text
            pxOverlap = getBoundsOverlap(state.staticWidth, checkBounds, state.elementBounds); // get overlap
            if (makeLonger == undefined) makeLonger = pxOverlap < 0; // set makelonger if it hasn't been set
            guessLength = guessText.length;
        }
        while ((makeLonger && pxOverlap < 0 && guessText.length < wholeText.length) // repeat until edge found
            || (!makeLonger && pxOverlap >= 0 && guessText.length > 0));

        if (makeLonger && pxOverlap >= 0) { // Drop back a breakpoint if longer
            guessText = prevText;
            if (!isEllipsisRequired(state, wholeText, guessText.length))
                guessSuffix = setSplitSuffix(state, guessText, wholeText, guessSuffix);
            state.splitNode.node.data = guessText;
        }

        return endSplitText(state, guessText, wholeText, guessSuffix);
    }
    // Finalize text split and suffix placement, return false if no more splitting is viable
    function endSplitText(state, guessText, wholeText, guessSuffix) {
        var breakTextNode, actualLength = guessText.trim().length;
        if (actualLength === 0) {
            state.splitNode.node.data = wholeText;
            hideNode(state.suffix);
            if (state.lastBreakIndex === state.splitIndex) return false;
            guessSuffix = false;
            breakTextNode = state.splitNode.node;
        }
        else if (guessText.length === wholeText.length) {// Must be last  line of text
            state.splitIndex++;
            return false;
        }
        else {
            breakTextNode = document.createTextNode(wholeText.slice(guessText.length));
            insertAfterText(guessSuffix === true ? state.suffix : state.splitNode.node, breakTextNode, state.usesRange);
            state.children.splice(state.splitIndex + 1, 0, { node: breakTextNode, level: state.splitNode.level });
            state.splitIndex++; // move forward to new node
        }
        if (guessSuffix === true)
            state.suffix = null; // lock suffix
        addBreak(state, breakTextNode);
        return true;
    }
    // Move splitindex to the next sibling being tracked from the current split node 
    function moveToNextNonChildNode(state) {
        var current = state.children[state.splitIndex], level;
        if (current) level = current.level;
        current = state.children[++state.splitIndex];
        while (current && current.level > level) {
            state.splitIndex++;
            current = state.children[state.splitIndex + 1]
        }
        if (!current) state.splitIndex++;
    }
    // move splitindex to the last sibling being tracked from the current split node 
    function moveToLastLevelNode(state) {
        var current = state.children[state.splitIndex], level;
        if (current) level = current.level;
        current = state.children[state.splitIndex + 1];
        while (current && current.level >= level) {
            state.splitIndex++;
            current = state.children[state.splitIndex + 1];
        }
    }
    // Hide overflow, starting at the current splitIndex
    function hideOverflow(state) {
        // Start at current split node
        var firstNode;
        // process until no more nodes
        while (firstNode = state.children[state.splitIndex]) {
            moveToLastLevelNode(state)
            state.hideWrappers[firstNode.level] =
                hideNodes(firstNode.node, state.children[state.splitIndex],
                state.settings.hiddenClass, state.settings.useInlineStyles);
            state.splitIndex++;
        }
    }
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
    // Remove previous formatting in element from textwrapper
    function clearFormatting(state) {
        if (state.isRefresh) {
            state.hideWrappers.forEach(unwrapInner);
            state.hideWrappers = [];
        }
        else
            removeSpans(state.element, state.settings.hiddenClass, true);

        removeBreaks(state.element, state.settings.breakClass);
        removeSpans(state.element, state.settings.suffixClass, false);
    }
    //#endregion 
    //#region Helper Methods
    // Make initial guess of desired text length for element
    function getSplitEstimate(foundWidth, wholeText, pxOverlap, staticWidth) {
        var pxPerChar = foundWidth / wholeText.trim().length;
        return Math.max(0, Math.ceil(wholeText.length - pxOverlap / pxPerChar - staticWidth / pxPerChar));
    }
    function createRangeBounds(node) {
        var range;
        if (!(range = TextWrapper.prototype.range))
            range = TextWrapper.prototype.range = document.createRange();
        range.selectNode(node);
        return new ElementBounds(range);
    }
    // Remove breaks in element from TextWrapper
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
    // Get new bounds, return true if refresh required
    function isBoundsChanged(bounds, forceRefresh) {
        var ol = bounds.getInnerLeft(),
            or = bounds.getInnerRight();
        bounds.resetRect();
        return forceRefresh || or !== bounds.getInnerRight() ||
            ol !== bounds.getInnerLeft();
    }
    // Wrap text node in clone used to check size
    function wrapTextForSize(node, className, useInlineStyles) {
        var parent = node.parentNode;
        var clone = parent.cloneNode();
        if (useInlineStyles)
            clone.style.cssText =
                'position:static;visibility:visible;overflow:visible;white-space:nowrap;top:auto;left:auto;right:auto;bottom:auto;width:auto;height:auto;display:inline;border-width:0;padding:0;margin:0';
        clone.className += ' ' + className;
        // Put hidden size test clone in document
        parent.insertBefore(clone, node).insertBefore(node);
        return clone;
    }
    // Get next valid split index of a string based on guess and desired direction of adjustment
    function getValidSplit(wholeText, guessLength, minWordBreakLength, forceBreak, makeLonger) {
        var nextValidIndex = makeLonger ?
            wholeText.indexOf(' ', guessLength) : wholeText.lastIndexOf(' ', guessLength - 2);
        if (forceBreak && ((nextValidIndex === -1 && !makeLonger) || (guessLength <= 0 && makeLonger)))
            minWordBreakLength = 1;
        if (makeLonger && nextValidIndex === -1) nextValidIndex = wholeText.length - 1;
        var breakSize = Math.abs((makeLonger ? wholeText.lastIndexOf(' ', guessLength) : nextValidIndex) + 1 - guessLength);
        if (minWordBreakLength > 0 && (makeLonger ? breakSize >= minWordBreakLength : breakSize > minWordBreakLength))
            nextValidIndex = makeLonger ? guessLength : guessLength - 2;
        if (isSpace(wholeText, nextValidIndex - 1)) nextValidIndex += makeLonger ? 1 : -1; // skip space character
        return wholeText.slice(0, Math.max(0, nextValidIndex + 1));
    }
    // Order by a depth first type pattern
    function getFlattenedChildren(element) {
        var nodes = [], parentStack = [], current = element.firstChild,
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
                nodes.push({ node: current, level: lvl }); // Store in tree
                lvl++; // move down a level
                scanDown = (current = current.firstChild) !== null; // set scan down according to children
            }
            do {
                current = parentStack.pop();// pop a node off the parent stack and move up to its level
                lvl--;
            } while (!current.nextSibling && parentStack.length > 0)
            current = current.nextSibling; // Move forward and search deep again
            scanDown = true;
        }
        return nodes;
    };
    // Get extent to which 2 elementbounds overlap considering any additional static width on the inner
    function getBoundsOverlap(staticWidth, innerItemBounds, outerItemBounds) {
        return staticWidth +
                innerItemBounds.getOuterRight() - outerItemBounds.getInnerRight();
    }
    //#endregion
    //#region Utility Dom Manipulation
    // Wrap 2 siblings and everything in between with hide span
    function hideNodes(startNode, endNode, className, useInlineStyle) {
        // create hide span
        var hideSpan = document.createElement('span');
        hideSpan.className = className;
        if (useInlineStyle) hideSpan.style.display = 'none';

        var currentNode = startNode,
            nextNode,
            parentNode = startNode.parentNode,
            nextSibling = endNode.nextSibling;
        do {
            nextNode = currentNode.nextSibling;
            hideSpan.insertBefore(currentNode);
        } while ((currentNode = nextNode) && nextNode != nextSibling)
        parentNode.insertBefore(hideSpan, nextSibling);
        return hideSpan;
    }
    // Set node css to display:none
    function hideNode(node) {
        if (!node) return;
        node.style.display = 'none';
    }
    // Clear node display property
    function showNode(node) {
        node.style.display = '';
    }
    // Delete node from dom
    function deleteNode(node) { node.parentNode.removeChild(node); }
    // Remove node parent, keep children
    function unwrap(node) {
        var parent = node.parentNode;
        var nodes = parent.childNodes;
        if (parent.hasChildNodes)
            while (parent.hasChildNodes()) {
                parent.parentNode.insertBefore(parent.firstChild, parent);
            }
        parent.parentNode.removeChild(parent);
    }
    // Remove node, keep children
    function unwrapInner(node) {
        if (node.firstChild) unwrap(node.firstChild);
        else deleteNode(node);
    }
    // Remove or unwrap spans matching description
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
    // Create and optionally insert a new element
    function insertNewElement(tagName, className, innerHTML, nextSibling, parent) {
        var node = document.createElement(tagName);
        if (className) node.className = className;
        if (innerHTML) node.innerHTML = innerHTML;
        if (parent) parent.insertBefore(node, nextSibling);
        return node;
    }
    // Insert a node after a text node taking into acount text wrapper elements
    function insertAfterText(textNode, insertNode, usesRange) {
        var nextSibling = usesRange ? textNode.nextSibling : textNode.parentNode.nextSibling;
        var parent = usesRange ? textNode.parentNode : textNode.parentNode.parentNode;
        parent.insertBefore(insertNode, nextSibling);
    }
    //#endregion
    //#region Utility string functions
    // Right trim string space
    function rTrim(item) { return item.replace(/\s+$/gm, ''); }
    // Check if specified char of string is space
    function isSpace(string, index) { return /[\t\n\r ]$/.test(string[index]); }
    //#endregion

    // Track / calculate bounds of an element
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

        this.getPosition = function () {
            return style ? style.getPropertyValue('position') : '';
        }

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
            return this.getBoundingRect().right + this.getMarginRight();
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

    //#region Test Access
    this._wrapLines = wrapLines;
    this._resetState = resetState;
    this._tryAddBreak = tryAddBreak;
    this._setSplitNodeBounds = setSplitNodeBounds;
    this._createTextBounds = createTextBounds;
    this._updateStaticWidth = updateStaticWidth;
    this._isEllipsisRequired = isEllipsisRequired;
    this._setSplitSuffix = setSplitSuffix;
    this._addBreak = addBreak;
    this._startSplitText = startSplitText;
    this._endSplitText = endSplitText;
    this._moveToNextNonChildNode = moveToNextNonChildNode;
    this._moveToLastLevelNode = moveToLastLevelNode;
    this._hideOverflow = hideOverflow;
    this._addSuffix = addSuffix;
    this._clearFormatting = clearFormatting;
    this._createRangeBounds = createRangeBounds;
    this._getSplitEstimate = getSplitEstimate;
    this._removeBreaks = removeBreaks;
    this._isBoundsChanged = isBoundsChanged;
    this._wrapTextForSize = wrapTextForSize;
    this._getValidSplit = getValidSplit;
    this._getFlattenedChildren = getFlattenedChildren;
    this._getBoundsOverlap = getBoundsOverlap;
    this._hideNodes = hideNodes;
    this._hideNode = hideNode;
    this._showNode = showNode;
    this._deleteNode = deleteNode;
    this._unwrap = unwrap;
    this._unwrapInner = unwrapInner;
    this._removeSpans = removeSpans;
    this._insertNewElement = insertNewElement;
    this._insertAfterText = insertAfterText;
    this._rTrim = rTrim;
    this._elementBounds = ElementBounds;
    this._isSpace = isSpace;
    //#endregion

    // Utility method for debouncing resize
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
    // Remove resize handler
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
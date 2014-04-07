// Examples and license at https://github.com/npbenjohnson/jquery.textWrap.js

(function ($) {
    $.event.special.removed = {
        remove: function (o) {
            if (o.handler) {
                o.handler(o);
            }
        }
    }
})(jQuery)

jQuery.fn.extend({
    textWrap: function (options, doNotForce) {
        //#region Settings
        var settings;

        if (!(settings = this.data('tw.settings'))) {
            settings = {
                // Width to wrap to (% or px)
                width: '100%',
                // number = number of lines 0 = unlimited
                lines: 0,
                // Recalculate on window.resize (will only be used if % width)
                handleResize: true,
                // Character count which must stay on the line for a word to break
                minWordBreakLength: 6,
                // Used for jquery clone call
                preserveDataAndEvents: false,
                // CSS classes for wrap elements
                brClass: 'tw',
                hiddenClass: 'twhidden',
                tempLineClass: 'twline',
                suffixClass: 'tw',
                // puts display:none inline, hiddenclass and templine class must be hidden 
                // using css if this is false
                useInlineStyles: true
            };
        }
        settings = $.extend(settings, options);
        //#endregion

        //#region Destroy
        function destroy($this) {
            removeHandlers($this);
            removePreviousWrap($this);
            $this.data({
                'tw.settings': null,
                'tw.prevWidth': null
            });
        }

        // Returns true if anything removed
        function removePreviousWrap($element) {
            // Remove previous wrapping
            var hidden = $element.find('span.' + settings.hiddenClass);
            var br = $element.find('br.' + settings.brClass + ', span.' + settings.suffixClass);
            var changed = hidden.length > 0 || br.length > 0;
            hidden.contents().unwrap();
            br.remove();
            return changed;
        }

        // Remove handlers on this element
        function removeHandlers($this) {
            var h;
            if ((h = $this.data('tw.handler'))) {
                $(window).off('resize.tw', h);
                $this.data('tw.handler', null);
            }
            $this.off('removed.tw');
        }

        //--------------------------------------DESTROY on options = false
        if (options === false) {
            if (this.data('tw.settings'))
                destroy(this);
            return this;
        }

        //#endregion

        //#region Main (horribly unwieldly) functions
        // Change the text currently being measured
        function refreshElementText() {
            var textDelta = textLengthGuess - textLengthGuessPrev,
                isAdd = textDelta > 0;
            textDelta = Math.abs(textDelta);

            // detach suffix
            if ($suffixElement) $suffixElement.detach();

            var $changeNode = isAdd ? $hiddenTextNodes.first() : $visibleTextNodes.last();
            // Normalize if this is an add, or the removed node is being moved next to the last text node
            var normalize;

            // Hide nodes until delta is shorter than node length
            while ($changeNode.length && (nodeTextLength = $changeNode.text().length) <= textDelta) {
                normalize = isAdd ||
               ($hiddenTextNodes.length > 0
               && ($changeNode[0]
               && $changeNode[0].nextSibling
               && $changeNode[0].nextSibling.firstChild === $hiddenTextNodes[0])),
               nodeTextLength;
                // Move whole node
                if (isAdd)
                    // unwrap whole hidden node
                    $changeNode.unwrap();
                else
                    if (normalize)
                        // move visible node into hidden span
                        $hiddenTextNodes.first().before($changeNode);
                    else
                        // hide wrap visible node
                        wrapHide($changeNode, settings.hiddenClass);
                // try to normalize the node that moved
                if (normalize && normalizeDeleteNode($changeNode[0], isAdd))
                    // node was deleted so old tracking can be removed
                    removeNodeTracking(!isAdd);
                else
                    // node was not deleted, shift tracking over 1 spot
                    shiftNodeTracking(isAdd);
                // Go to next node
                $changeNode = isAdd ? $hiddenTextNodes.first() : $visibleTextNodes.last();
                textDelta -= nodeTextLength;
            }
            // Change ends in middle of node
            if (textDelta > 0) {
                normalize = isAdd ||
               ($hiddenTextNodes.length > 0
               && ($changeNode[0]
               && $changeNode[0].nextSibling
               && $changeNode[0].nextSibling.firstChild === $hiddenTextNodes[0])),
               nodeTextLength;
                // node is the second half of split text which is a new element 
                var rightNode = $changeNode[0].splitText(isAdd ? textDelta : nodeTextLength - textDelta),
                // node is first half of split and will remain tracked
                    leftNode = rightNode.previousSibling;

                if (isAdd) {
                    // On add, move untracked node into visible area
                    leftNode.parentNode.parentNode.insertBefore(leftNode, leftNode.parentNode);

                    if (!normalizeDeleteNode(leftNode, true, true))
                        // Node still exists, shift it to visible
                        shiftNodeTracking(true);
                }
                else {
                    if (normalize)
                        // On hide, move second node into hide span
                        $hiddenTextNodes.first().before(rightNode);
                    else
                        // On non-normalize hide, wrap second node and track
                        wrapHide($(rightNode), settings.hiddenClass);
                }
                // add new node to tracking if not deleted
                if (isAdd || !normalize || !normalizeDeleteNode(rightNode, false))
                    addNodeTracking(rightNode, false);
            }
            // Attach suffix
            if ($suffixElement && $suffixElement.parent().length === 0)
                $visibleTextNodes.last().after($suffixElement);

            foundWidth = $element.width();
        }

        // Wraps a single text line, returns true if wrap is complete, false if line needs to be reprocessed
        function wrapTextLine() {
            // Adjust using binary-ish search
            while (textLowBound < textHighBound) {

                // Use the current guess first if line is being reprocessed
                if (!reprocessingLine) {
                    // Get next guess using ratio of desiredwidth / foundWidth
                    var suffixAdd = ($suffixElement && $suffixElement.parent().length === 1 ? suffixLength : 0);
                    var newCharCountGuess = Math.round(desiredWidth / foundWidth * (textLengthGuess + suffixAdd));
                    setTextLengthGuess(Math.min(Math.max(newCharCountGuess, textLowBound + 1), textHighBound));
                }
                else
                    reprocessingLine = false;

                // Refresh displayed text
                refreshElementText();
                if ($hiddenTextNodes.length === 0) { return true; }

                // Update search parameters
                if (foundWidth < desiredWidth) textLowBound = textLengthGuess;
                if (foundWidth >= desiredWidth) {
                    textHighBound = textLengthGuess - 1;
                    // Exit on 0 length lines
                    if (textLengthGuess === 0)
                        return true;
                }
            }

            var lengthAdjust = 0;
            if (foundWidth >= desiredWidth)
                // last check must have found max, drop back a character
                lengthAdjust -= 1;

            if (validWrapLengths) {
                // Snap index to a valid wrap length
                var lowIndex = 0,
                    highIndex = validWrapLengths.length,
                    // Use adjusted length because these indexes were calculated without suffixes
                    // and before wholetext had lines sliced out.
                    relativeLength = (textLengthGuess + lengthAdjust) + lineTextOffset + suffixLength,
                    guess;
                while (lowIndex < highIndex) {
                    guess = Math.floor((lowIndex + highIndex) / 2);
                    if (validWrapLengths[guess] <= relativeLength) { lowIndex = ++guess; continue; }
                    if (validWrapLengths[guess] > relativeLength) { highIndex = guess; continue; }
                }
                lengthAdjust = validWrapLengths[highIndex - 1] - lineTextOffset - suffixLength - textLengthGuess;
            }

            // check if this is a word break
            if ($suffixElement === null && !textLengthIsSpace(textLengthGuess + lengthAdjust)) {
                if (textLengthIsSpace(textLengthGuess + lengthAdjust - 1)) {
                    //character before break is a space, move break back a character
                    lengthAdjust -= 1;
                }
                else {
                    // breaking on a word, change suffix
                    setSuffix('-');
                    setTextLengthGuess(textLengthGuess + lengthAdjust);
                    textLowBound = Math.max(-1, textLengthGuess - 1);
                    textHighBound = Math.min(wholeText.length, textLengthGuess + 1);
                    // return false to indicate line not finalized
                    return false;
                }
            }

            // Apply final adjustments
            if (lengthAdjust !== 0) {
                setTextLengthGuess(textLengthGuess + lengthAdjust);
                refreshElementText();
            }

            // return true to indicate line finalized
            return true;
        }

        // Iterates lines to wrap and truncate all text
        function wrapAllTextLines() {
            // Tracks if current iteration of text search is making
            // a suffix adjustment
            while (foundWidth >= desiredWidth || $hiddenTextNodes.length > 0 || reprocessingLine) {

                if (lineNumber === settings.lines) {
                    // Final iteration, justify to elipses
                    setSuffix('…');
                    validWrapLengths = null;
                }

                // Find a character breakpoint, adjust must be applied to text before finalizing line
                reprocessingLine = !wrapTextLine();
                // Last line, no end of line processing required
                if (lineNumber === settings.lines || ($hiddenTextNodes.length === 0 && !reprocessingLine))
                    break;

                if (!reprocessingLine) {
                    // Break off the finalized line and reset tracking
                    if ($suffixElement && textLengthIsSpace(textLengthGuess)) {
                        // Remove '-' suffix if breaking on a space after adjustments
                        $suffixElement.remove();
                        setSuffix(null);
                    }

                    // Add line break
                    if ($suffixElement)
                        $visibleTextNodes = $visibleTextNodes.add($suffixElement);
                    $visibleTextNodes.last().after('<br class="' + settings.brClass + '"/>');
                    wrapHide($visibleTextNodes, settings.tempLineClass);

                    // reset tracking values and slice off finalized line
                    $visibleTextNodes = $();
                    lineTextOffset += textLengthGuess;
                    wholeText = wholeText.slice(textLengthGuess);
                    textLowBound = -1;
                    textLengthGuessPrev = 0;
                    textHighBound = wholeText.length;
                    textLengthGuess = Math.min(textLengthGuess, wholeText.length);
                    reprocessingLine = wholeText.length > 0;
                    // lock suffix element
                    if ($suffixElement)
                        setSuffix(null);
                    if (settings.lines > 0)
                        lineNumber++;
                }
            }
            // Remove the spans hiding valid lines
            $element.find('.' + settings.tempLineClass).contents().unwrap();
        }

        //#endregion

        //#region Properties / utility

        // Updates length guess and stored previous
        function setTextLengthGuess(val) {
            textLengthGuessPrev = textLengthGuess;
            textLengthGuess = val;
        }

        // Shift between the top of visible nodes and the bottom of hidden
        function shiftNodeTracking(addVisible) {
            addNodeTracking(removeNodeTracking(!addVisible), addVisible);
        }

        // Remove a node from one of the tracking lists
        function removeNodeTracking(removeVisible) {
            var removed;
            if (removeVisible) {
                removed = $visibleTextNodes.last();
                $visibleTextNodes = $visibleTextNodes.slice(0, -1);
            }
            else {
                removed = $hiddenTextNodes.first();
                $hiddenTextNodes = $hiddenTextNodes.slice(1);
            }
            return removed;
        }

        // Add a node to one of the tracking lists
        function addNodeTracking(node, addVisible) {
            if (addVisible) $visibleTextNodes = $visibleTextNodes.add(node);
            else $hiddenTextNodes = $hiddenTextNodes.add(node);
        }

        // normalize with only sibling depth, returns true if original node is removed
        function normalizeDeleteNode(node, removeVisible, nodeIsTracked) {
            var next, originalRemoved = false;
            // find all text siblings
            while ((next = (removeVisible ? node.previousSibling : node.nextSibling))
                && next.nodeType === 3) {
                // Append to beginning or end depending on direction
                if (removeVisible)
                    next.appendData(node.data);
                else
                    next.insertData(0, node.data);
                // Remove text that had its data merged
                node.parentNode.removeChild(node);
                // If the node is in tracking, remove it
                if (removeVisible !== undefined)
                    if (originalRemoved)
                        removeNodeTracking(removeVisible);
                    else if (nodeIsTracked)
                        // if original node is tracked it will be removed the opposite visibility
                        removeNodeTracking(!removeVisible);
                // move to next node
                node = next;
                originalRemoved = true;
            }
            return originalRemoved;
        }
        // Set the suffix for the current line (null to clear)
        function setSuffix(sfx) {
            suffixLength = sfx ? sfx.length : 0;
            $suffixElement = sfx ? $('<span class="' + settings.suffixClass + '">' + sfx + '</span>') : null;
        }

        // Check if whole text character is a space char (can be on either side of character)
        function textLengthIsSpace(index) {
            return /[\t\n\r ]/.test(wholeText[index]) || /[\t\n\r ]/.test(wholeText[index - 1]);
        }

        function wrapHide($node, className) {
            $node.wrap('<span' +
                (settings.useInlineStyles ? ' style="display:none"' : '') +
                (className ? ' class="' + className + '"' : '') +
                '></span>');
        }
        //#endregion

        //#region Initialization Functions
        // jquery workaround #14960 
        function getTextContents($nodes) {
            return $().add($nodes.contents()
                 .filter(function () {
                     if (this.data && !/^[\t\n\r ]+$/.test(this.data) && this.nodeType === 3) {
                         this.data = this.data.replace(/[\t\n\r ]+/g, ' ');
                         return true;
                     }
                     return false;
                 }));
        }

        // Returns an array of indexes where a text can be wrapped, null if none or none required
        function getValidWrapLengths() {
            if (settings.minWordBreakLength <= 1) { return null; }

            // get words in text
            var words = wholeText.split(/[\t\n\r ]+/).filter(function (item) { return item !== ''; });
            var textLength = 0, wordLength, validWrapLengths = [];
            for (var i = 0; i < words.length; i++) {
                if (i > 0) {
                    // Add break on either side of space
                    validWrapLengths.push(textLength);
                    validWrapLengths.push(textLength + 1);
                    textLength += 1;
                }

                wordLength = words[i].length;

                // Add breakable indices of word
                for (var j = settings.minWordBreakLength; j <= wordLength; j++)
                    validWrapLengths.push(textLength + j);
                textLength += wordLength;
            }
            return (validWrapLengths.length === 0 ? null : validWrapLengths);
        }


        // initialize clone used to check size
        function initClone($this) {
            $element = $this.clone(settings.preserveDataAndEvents);
            $element.css({
                'position': 'absolute',
                'float': 'left',
                'visibility': '',//'hidden',
                'overflow': 'visible',
                'white-space': 'nowrap',
                'top': '',
                'left': '',
                'right': '',
                'bottom': '',
                'width': '',
                'height': ''
            });

            // Put hidden size test clone in document
            $element.insertAfter($this);
        }

        // get desired width, mark as responsive if %
        function getDesiredWidth($this) {
            var desiredWidth;
            if (settings.width.lastIndexOf && settings.width.lastIndexOf('%') !== -1) {
                isResponsive = true;
                desiredWidth = $this.width() * (parseInt(settings.width) / 100);
            }
            else {
                desiredWidth = parseInt(settings.width);
            }
            return desiredWidth;
        }

        //#endregion

        //#region Shared Properties
        // Line currently being wrapped
        var lineNumber = 1,
            // text index of the start of a line
            lineTextOffset = 0,
            // All text of element
            wholeText,

            // Tracks if element should handle resize events
            isResponsive,
            // Desired width of element in px
            desiredWidth = getDesiredWidth(this),
            // Width of element after after last call to refresh 
            foundWidth,

            // valid lengths for breaking text
            validWrapLengths,

            // Lowest checked char length of line
            textLowBound = -1,
            // Highest checked char length of line
            textHighBound,
            // guess at char length of line
            textLengthGuess,
            // Previous guess at char length of line
            textLengthGuessPrev,

            // current temporary suffix element if present
            suffixLength = 0,
            $suffixElement = null,

            // Clone element for size testing
            $element,
            // list of currently hidden text nodes
            $hiddenTextNodes = $(),
            // currently visible text nodes
            $visibleTextNodes,

            // Tracks if a line must have more than 1 iteration
            reprocessingLine = false;

        //#endregion

        if (!doNotForce || this.data('tw.prevWidth') !== desiredWidth) {
            initClone(this);
            var changed = removePreviousWrap($element);
            changed = (foundWidth = $element.width()) >= desiredWidth || changed;
            if (changed) {
                // init wrap info
                var contents = getTextContents($element.find('*').andSelf());
                contents.each(function () { if (this.parentNode) normalizeDeleteNode(this); });

                $visibleTextNodes = $(contents.filter(function () { return this.parentNode; }));
                if ((wholeText = $visibleTextNodes.text()).length > 0) {
                    validWrapLengths = getValidWrapLengths();
                    textLengthGuessPrev = textLengthGuess = textHighBound = wholeText.length;

                    // Perform word wrap / truncate if text wide
                    wrapAllTextLines();
                    // Save data for future wraps
                    this.data('tw.prevWidth', settings.desiredWidth);

                    // Move resized children from clone to element
                    this.contents().remove();
                    $element.contents().appendTo(this);
                }
            }
            $element.remove();
        }

        if (!this.data('tw.settings')) {
            this.on('removed', this, function (evt) {
                evt.data.textWrap(false);
            });
        }

        this.data('tw.settings', settings);

        // create resize handler
        if (settings.handleResize && isResponsive && !this.data('tw.handler')) {
            var handlerFunction = function wrap(evt) {
                evt.data.textWrap(null, true);
            };
            this.data('tw.handler', handlerFunction);
            // Handle resize by adjusting wrap
            $(window).on('resize.tw', this, handlerFunction);
        }
    }
});






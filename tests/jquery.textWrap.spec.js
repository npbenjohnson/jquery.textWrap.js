/// <reference path="C:\TFS\TheDoxterminator\bcdoc\trunk\bcdoc\bcdoc.Web\Script/lib/tw2.js" />

describe("textWrap", function () {
    document.body.style.margin = "0";
    var w = new TextWrapper();
    describe('general wrap tests verified in chrome to make sure nothing changes without notice', function () {
        it("human verified chrome test 1", function () {
            var item = document.createElement('DIV');
            item.id = 'yo';
            item.style.width = '40px';
            item.style.whiteSpace = 'nowrap';
            item.innerHTML = '<div>abcdefghij   <a>  k <div>lmno</div> pqrst u</a> vwxy</div>z';
            document.body.insertBefore(item, document.body.firstChild);
            $('#yo').textWrap();
            expect(item.innerHTML).toEqual('<div>abcd<span class="tw.s">-</span><br class="tw.b">efghij <a><br class="tw.b"> k <div>lmno</div> pqrst <br class="tw.b">u</a><br class="tw.b"> vwxy</div>z');
            document.body.removeChild(document.body.firstChild);
        });

        it("human verified chrome test 2", function () {
            var item = document.createElement('DIV');
            item.id = 'yo';
            item.style.width = '100px';
            item.style.whiteSpace = 'nowrap';
            item.innerHTML = 'asdfasdfasdfasdfasdfasdfasdfasdfasdfadsfasdf\r\n\t asdfasdfasdfasdfwwwwwwwwww asdf';
            document.body.insertBefore(item, document.body.firstChild);
            var settings = new TextWrapper.prototype.TextWrapperSettings();
            settings.maxLines = 5;
            settings.width = '50%';
            $('#yo').textWrap(settings);
            expect(item.innerHTML).toEqual('asdfas<span class="tw.s">-</span><br class="tw.b">dfasdf<span class="tw.s">-</span><br class="tw.b">asdfas<span class="tw.s">-</span><br class="tw.b">dfasdf<span class="tw.s">-</span><br class="tw.b">asdfa<span class="tw.s">' + String.fromCharCode(8230) + '</span><br class="tw.b"><span class="tw.h" style="display: none;">sdfasdfadsfasdf asdfasdfasdfasdfwwwwwwwwww asdf</span>');
            document.body.removeChild(document.body.firstChild);
        });

        it("human verified chrome test 3", function () {
            var item = document.createElement('DIV');
            item.id = 'yo';
            item.style.width = '200px';
            item.style.whiteSpace = 'nowrap';
            item.innerHTML = 'asdf<img style="width:175px;height:1px"></img>asdfasdfasdf<a style="padding:20px">as<b style="padding:20px">df</b></a>asdf<span>as<b style="padding:100px">df</b>as</span>dfa<div>sdfadsfasdf\r\n\t asdfasd</div>fasdfasdfw<span>wwwwwwwww</span> asdf';
            document.body.insertBefore(item, document.body.firstChild);
            var settings = new TextWrapper.prototype.TextWrapperSettings();
            settings.maxLines = 0;
            settings.width = '150px';
            $('#yo').textWrap(settings);
            expect(item.innerHTML).toEqual('asdf<br class="tw.b"><img style="width:175px;height:1px"><br class="tw.b">asdfasdfasdf<a style="padding:20px">as<br class="tw.b"><b style="padding:20px">df</b></a>asdf<span>as<br class="tw.b"><b style="padding:100px"><br class="tw.b">df</b>as</span>dfa<div>sdfadsfasdf asdfasd</div>fasdfasdfw<span>wwwwwww<span class="tw.s" style="">-</span><br class="tw.b">ww</span> asdf');
            document.body.removeChild(document.body.firstChild);
        });
    });


    //this._wrapLines = wrapLines;
    it("resetState should reset state", function () {
        var model = new TextWrapper.prototype.TextWrapperModel();
        model.breaks = model.lastBreakIndex = model.splitIndex = model.splitNode = model.staticWidth = model.staticWidthStack = 'fail';
        w._resetState(model);
        expect(model.breaks).toEqual(0);
        expect(model.lastBreakIndex).toEqual(0);
        expect(model.splitIndex).toEqual(0);
        expect(model.splitNode).toEqual(null);
        expect(model.staticWidth).toEqual(0);
        expect(model.staticWidthStack.length).toEqual(0);
    });

    //this._tryAddBreak = tryAddBreak;
    it('tryAddBreak should break before and item too large to break, unless it is the beginning of a line', function () {
        var model = new TextWrapper.prototype.TextWrapperModel(item);
        var item = document.createElement('SPAN');
        document.body.insertBefore(item, document.body.firstChild);
        item.innerHTML = 'asdf<span style="border-style:solid;border-left-width:500px;"></span><span>asdf</span>';
        model.children = w._getFlattenedChildren(item);
        model.splitIndex = 1;
        model.splitNode = model.children[model.splitIndex];
        model.splitNode.bounds = new w._elementBounds(model.splitNode.node);
        w._tryAddBreak(model, 100);
        expect(item.firstChild.nextElementSibling.tagName).toEqual('BR');
        expect(model.splitIndex).toEqual(2);
        model.splitNode = model.children[model.splitIndex];
        model.splitNode.bounds = new w._elementBounds(model.splitNode.node);
        w._tryAddBreak(model, 100);
        expect(item.firstChild.nextSibling.nextSibling.nextSibling.tagName).toEqual('BR');
        document.body.removeChild(document.body.firstChild);
    });

    //this._setSplitNodeBounds = setSplitNodeBounds;
    //this._createTextBounds = createTextBounds;

    it('updateStaticWidth should do nothing if there is no previous node', function () {
        var model = new TextWrapper.prototype.TextWrapperModel();
        w._updateStaticWidth(model, null);
        expect(model.staticWidth).toEqual(0);
        expect(model.staticWidthStack.length).toEqual(0);
    });

    it('updateStaticWidth should add and remove from stack while traversing', function () {
        var item = document.createElement('SPAN');
        item.innerHTML = '<span style="border-style:solid;border-right-width:10px;padding-right:15px"><span style="border-style:solid;border-right-width:20px;padding-right:25px">asdf</span></span><span></span>';
        document.body.insertBefore(item, document.body.firstChild);
        var model = new TextWrapper.prototype.TextWrapperModel(item);
        model.children = w._getFlattenedChildren(item);
        model.children[0].bounds = new w._elementBounds(model.children[0].node);
        model.splitIndex = 1;
        model.splitNode = model.children[model.splitIndex];
        model.splitNode.bounds = new w._elementBounds(model.splitNode.node);
        w._updateStaticWidth(model, model.children[model.splitIndex - 1]);
        expect(model.staticWidth).toEqual(25);
        expect(model.staticWidthStack[0]).toEqual(0);
        expect(model.staticWidthStack.length).toEqual(1);
        model.splitIndex = 2;
        model.splitNode = model.children[model.splitIndex];
        model.splitNode.bounds = new w._elementBounds(model.splitNode.node);
        w._updateStaticWidth(model, model.children[model.splitIndex - 1]);
        expect(model.staticWidth).toEqual(70);
        expect(model.staticWidthStack[1]).toEqual(25);
        expect(model.staticWidthStack.length).toEqual(2);
        model.splitIndex = 3;
        model.splitNode = model.children[model.splitIndex];
        model.splitNode.bounds = new w._elementBounds(model.splitNode.node);
        w._updateStaticWidth(model, model.children[model.splitIndex - 1]);
        expect(model.staticWidth).toEqual(0);
        expect(model.staticWidthStack.length).toEqual(0);
        document.body.removeChild(document.body.firstChild);
    });

    it('isEllipsisRequired should add an ellipsis and return true if on the last line and not the last char of the last word', function () {
        var item = document.createElement('SPAN');
        item.innerHTML = '<span id="1">asdf<span id="2"></span></span><span id="3">asdf</span>';
        var settings = new TextWrapper.prototype.TextWrapperSettings();
        settings.maxLines = 1;
        var model = new TextWrapper.prototype.TextWrapperModel(item, settings);
        model.children = w._getFlattenedChildren(item);
        model.splitIndex = 1;
        model.splitNode = model.children[model.splitIndex];
        var result = w._isEllipsisRequired(model, 'asdf', 'asdf');
        expect(item.firstChild.firstChild.nextSibling).toEqual(model.suffix);
        expect(model.suffix.innerHTML).toEqual(String.fromCharCode(8230));
        expect(model.suffix.className).toEqual(settings.suffixClass);
        expect(model.suffixBounds === null).toEqual(false);
        expect(result).toEqual(true);
    });

    it('isEllipsisRequired should return false if not on the last line', function () {
        var item = document.createElement('SPAN');
        item.innerHTML = '<span id="1">asdf<span id="2"></span></span><span id="3">asdf</span>';
        var settings = new TextWrapper.prototype.TextWrapperSettings();
        settings.maxLines = 2;
        var model = new TextWrapper.prototype.TextWrapperModel(item, settings);
        model.children = w._getFlattenedChildren(item);
        model.splitIndex = 1;
        model.splitNode = model.children[model.splitIndex];
        var result = w._isEllipsisRequired(model, 'asdf', 'asdf');
        expect(model.suffix).toEqual(null);
        expect(result).toEqual(false);
    });

    it('isEllipsisRequired should return false and hide any existing ellipsis if on the last char of the last line', function () {
        var item = document.createElement('SPAN');
        item.innerHTML = '<span id="1">asdf<span id="2"></span></span><span id="3">asdf</span>';
        var settings = new TextWrapper.prototype.TextWrapperSettings();
        settings.maxLines = 1;
        var model = new TextWrapper.prototype.TextWrapperModel(item, settings);
        model.children = w._getFlattenedChildren(item);
        model.splitIndex = 1;
        model.splitNode = model.children[model.splitIndex];
        w._isEllipsisRequired(model, 'asdf', 'asdf');
        expect(model.suffix === null).toEqual(false);
        model.splitIndex = 4;
        model.splitNode = model.children[model.splitIndex];
        var result = w._isEllipsisRequired(model, 'asdf', 'asdf');
        expect(model.suffix.style.display).toEqual('none');
        expect(result).toEqual(false);
    });

    it('setSplitsuffix should add or move when value changed to true from null', function () {
        var item = document.createElement('SPAN');
        item.innerHTML = '<span id="1">asdf<span id="2"></span></span><span id="3">asdf</span>';
        var settings = new TextWrapper.prototype.TextWrapperSettings();
        var model = new TextWrapper.prototype.TextWrapperModel(item, settings);
        model.children = w._getFlattenedChildren(item);
        model.splitIndex = 1;
        model.splitNode = model.children[model.splitIndex];
        w._setSplitSuffix(model, 'test', 'testfakelonger', null);
        expect(item.firstChild.firstChild.nextSibling).toEqual(model.suffix);
        expect(model.suffix.innerHTML).toEqual('-');
        expect(model.suffix.className).toEqual(settings.suffixClass);
        expect(model.suffixBounds === null).toEqual(false);
        model.splitIndex = 4;
        model.splitNode = model.children[model.splitIndex];
        w._setSplitSuffix(model, 'test', 'testfakelonger', null);
        expect(item.firstChild.nextSibling.firstChild.nextSibling).toEqual(model.suffix);
        expect(model.suffix.innerHTML).toEqual('-');
        expect(model.suffix.className).toEqual(settings.suffixClass);
        expect(model.suffix.style.display).toEqual('');
    });

    it('setSplitsuffix should be made visible when value changed to true from hidden', function () {
        var item = document.createElement('SPAN');
        item.innerHTML = '<span id="1">asdf<span id="2"></span></span><span id="3"></span>';
        var settings = new TextWrapper.prototype.TextWrapperSettings();
        var model = new TextWrapper.prototype.TextWrapperModel(item, settings);
        model.children = w._getFlattenedChildren(item);
        model.splitIndex = 1;
        model.splitNode = model.children[model.splitIndex];
        w._setSplitSuffix(model, 'test', 'testfakelonger', null);
        model.suffix.style.display = 'none';
        w._setSplitSuffix(model, 'test', 'testfakelonger', 'hidden');
        expect(item.firstChild.firstChild.nextSibling).toEqual(model.suffix);
        expect(model.suffix.innerHTML).toEqual('-');
        expect(model.suffix.className).toEqual(settings.suffixClass);
        expect(model.suffix.style.display).toEqual('');
    });

    it('setSplitsuffix should not add suffix when break is not a word break', function () {
        var item = document.createElement('SPAN');
        item.innerHTML = '<span id="1">asdf<span id="2"></span></span><span id="3"></span>';
        var settings = new TextWrapper.prototype.TextWrapperSettings();
        var model = new TextWrapper.prototype.TextWrapperModel(item, settings);
        model.children = w._getFlattenedChildren(item);
        model.splitIndex = 1;
        model.splitNode = model.children[model.splitIndex];
        w._setSplitSuffix(model, 'test', 'test', null);
        expect(model.suffix).toEqual(null);
        w._setSplitSuffix(model, 'test ', 'test asdf', null);
        expect(model.suffix).toEqual(null);
        w._setSplitSuffix(model, '', 'test', null);
        expect(model.suffix).toEqual(null);
        w._setSplitSuffix(model, '  ', '  asdf', null);
        expect(model.suffix).toEqual(null);
        w._setSplitSuffix(model, ' asdf ', ' asdf  ', null);
        expect(model.suffix).toEqual(null);
    });

    it('setSplitsuffix should hide existing suffix when set to false from true', function () {
        var item = document.createElement('SPAN');
        item.innerHTML = '<span id="1">asdf<span id="2"></span></span><span id="3"></span>';
        var settings = new TextWrapper.prototype.TextWrapperSettings();
        var model = new TextWrapper.prototype.TextWrapperModel(item, settings);
        model.children = w._getFlattenedChildren(item);
        model.splitIndex = 1;
        model.splitNode = model.children[model.splitIndex];
        w._setSplitSuffix(model, 'test', 'testa', null);
        w._setSplitSuffix(model, 'test ', 'test ', true);
        expect(model.suffix.style.display).toEqual('none');
    });

    it('addbreak should add a line break with class breakClass before the specified element', function () {
        var item = document.createElement('SPAN');
        item.innerHTML = '<span id="1"><span id="2"></span></span><span id="3"></span>';
        var settings = new TextWrapper.prototype.TextWrapperSettings();
        var model = new TextWrapper.prototype.TextWrapperModel(item, settings);
        model.children = w._getFlattenedChildren(item);
        model.splitIndex = 0;
        model.splitNode = model.children[model.splitIndex];
        w._addBreak(model);
        expect(item.firstChild.tagName).toEqual('BR');
        expect(item.firstChild.className).toEqual(settings.breakClass);
        expect(model.breaks).toEqual(1);
        expect(model.lastBreakIndex).toEqual(0);

        model.splitIndex = 2;
        model.splitNode = model.children[model.splitIndex];
        w._addBreak(model);
        expect(item.firstChild.nextSibling.nextSibling.tagName).toEqual('BR');
        expect(item.firstChild.nextSibling.nextSibling.className).toEqual(settings.breakClass);
        expect(model.breaks).toEqual(2);
        expect(model.lastBreakIndex).toEqual(2);
    });

    it('addbreak will not add a break if all lines have already been created', function () {
        var item = document.createElement('SPAN');
        item.innerHTML = '<span id="1"><span id="2"></span></span><span id="3"></span>';
        var settings = new TextWrapper.prototype.TextWrapperSettings();
        settings.maxLines = 1;
        var model = new TextWrapper.prototype.TextWrapperModel(item, settings);
        model.children = w._getFlattenedChildren(item);
        model.splitIndex = 0;
        model.splitNode = model.children[model.splitIndex];
        w._addBreak(model);
        expect(item.firstChild.tagName).toEqual('BR');
        expect(item.firstChild.className).toEqual(settings.breakClass);
        expect(model.breaks).toEqual(1);
        expect(model.lastBreakIndex).toEqual(0);

        model.splitIndex = 2;
        model.splitNode = model.children[model.splitIndex];
        w._addBreak(model);
        expect(item.firstChild.nextSibling.nextSibling.tagName).toEqual('SPAN');
        expect(model.breaks).toEqual(1);
        expect(model.lastBreakIndex).toEqual(0);
    });

    it('startSplitTextWith a short guess no possible break', function () {
        var item = document.createElement('SPAN');
        document.body.insertBefore(item, document.body.firstChild);
        var settings = new TextWrapper.prototype.TextWrapperSettings();
        item.innerHTML = 'asdf';
        var model = new TextWrapper.prototype.TextWrapperModel(item, settings);
        model.children = w._getFlattenedChildren(item);
        model.splitIndex = 0;
        model.splitNode = model.children[model.splitIndex];
        model.splitNode.bounds = w._createRangeBounds(model.splitNode.node);
        model.elementBounds = new w._elementBounds(item, '1px');
        var result = w._startSplitText(model, 'asdf', -1);
        expect(item.firstChild.data).toEqual('asdf');
        expect(result).toEqual(false);
        expect(model.splitIndex).toEqual(0);
        document.body.removeChild(document.body.firstChild);
    });

    it('startSplitTextWith a long guess no possible break', function () {
        var item = document.createElement('SPAN');
        document.body.insertBefore(item, document.body.firstChild);
        var settings = new TextWrapper.prototype.TextWrapperSettings();
        item.innerHTML = 'asdf';
        var model = new TextWrapper.prototype.TextWrapperModel(item, settings);
        model.children = w._getFlattenedChildren(item);
        model.splitIndex = 0;
        model.splitNode = model.children[model.splitIndex];
        model.splitNode.bounds = w._createRangeBounds(model.splitNode.node);
        model.elementBounds = new w._elementBounds(item, '1px');
        var result = w._startSplitText(model, 'asdf', 3);
        expect(item.firstChild.data).toEqual('asdf');
        expect(result).toEqual(false);
        expect(model.splitIndex).toEqual(0);
        document.body.removeChild(document.body.firstChild);
    });

    it('startSplitTextWith a long guess and forcebreak on space default behavior', function () {
        var item = document.createElement('SPAN');
        document.body.insertBefore(item, document.body.firstChild);
        var settings = new TextWrapper.prototype.TextWrapperSettings();
        item.innerHTML = 'asdfasdf asdfasdfasdfadsf asdfasdfasdf';
        var model = new TextWrapper.prototype.TextWrapperModel(item, settings);
        model.children = w._getFlattenedChildren(item);
        model.splitIndex = 0;
        model.splitNode = model.children[model.splitIndex];
        model.splitNode.bounds = w._createRangeBounds(model.splitNode.node);
        model.elementBounds = new w._elementBounds(item, '60px');
        var result = w._startSplitText(model, 'asdfasdfasdfasdf asdfadsfasdfasdfasdf', 25);
        expect(item.firstChild.data).toEqual('asdfasdf');
        expect(item.firstChild.nextSibling.innerHTML).toEqual('-');
        expect(item.firstChild.nextSibling.nextSibling.tagName).toEqual('BR');
        expect(item.firstChild.nextSibling.nextSibling.nextSibling.data).toEqual('asdfasdf asdfadsfasdfasdfasdf');
        expect(model.children[model.splitIndex].node.data).toEqual('asdfasdf asdfadsfasdfasdfasdf');
        expect(result).toEqual(true);
        document.body.removeChild(document.body.firstChild);
    });

    it('startSplitTextWith a short guess and forcebreak on space default behavior', function () {
        var item = document.createElement('SPAN');
        document.body.insertBefore(item, document.body.firstChild);
        var settings = new TextWrapper.prototype.TextWrapperSettings();
        item.innerHTML = 'asdfasdf asdfasdfasdfadsf asdfasdfasdf';
        var model = new TextWrapper.prototype.TextWrapperModel(item, settings);
        model.children = w._getFlattenedChildren(item);
        model.splitIndex = 0;
        model.splitNode = model.children[model.splitIndex];
        model.splitNode.bounds = w._createRangeBounds(model.splitNode.node);
        model.elementBounds = new w._elementBounds(item, '60px');
        var result = w._startSplitText(model, 'asdfasdfasdfasdf asdfadsfasdfasdfasdf', 4);
        expect(item.firstChild.data).toEqual('asdfasdf');
        expect(item.firstChild.nextSibling.innerHTML).toEqual('-');
        expect(item.firstChild.nextSibling.nextSibling.tagName).toEqual('BR');
        expect(item.firstChild.nextSibling.nextSibling.nextSibling.data).toEqual('asdfasdf asdfadsfasdfasdfasdf');
        expect(model.children[model.splitIndex].node.data).toEqual('asdfasdf asdfadsfasdfasdfasdf');
        expect(result).toEqual(true);
        document.body.removeChild(document.body.firstChild);
    });

    it('startSplitTextWith a very long guess and break on space default behavior', function () {
        var item = document.createElement('SPAN');
        document.body.insertBefore(item, document.body.firstChild);
        var settings = new TextWrapper.prototype.TextWrapperSettings();
        item.innerHTML = 'asdfasdf asdfasdfasdfadsf asdfasdfasdf asdfasdfasdf';
        var model = new TextWrapper.prototype.TextWrapperModel(item, settings);
        model.children = w._getFlattenedChildren(item);
        model.splitIndex = 0;
        model.splitNode = model.children[model.splitIndex];
        model.splitNode.bounds = w._createRangeBounds(model.splitNode.node);
        model.elementBounds = new w._elementBounds(item, '200px');
        var result = w._startSplitText(model, 'asdfasdf asdfasdfasdfadsf asdfasdfasdf asdfasdfasdf', 48);
        expect(item.firstChild.data).toEqual('asdfasdf asdfasdfasdfadsf ');
        expect(item.firstChild.nextSibling.tagName).toEqual('BR');
        expect(item.firstChild.nextSibling.nextSibling.data).toEqual('asdfasdfasdf asdfasdfasdf');
        expect(model.children[model.splitIndex].node.data).toEqual('asdfasdfasdf asdfasdfasdf');
        expect(result).toEqual(true);
        document.body.removeChild(document.body.firstChild);
    });

    it('startSplitTextWith a long guess and break on space default behavior', function () {
        var item = document.createElement('SPAN');
        document.body.insertBefore(item, document.body.firstChild);
        var settings = new TextWrapper.prototype.TextWrapperSettings();
        item.innerHTML = 'asdfasdf asdfasdfasdfadsf asdfasdfasdf';
        var model = new TextWrapper.prototype.TextWrapperModel(item, settings);
        model.children = w._getFlattenedChildren(item);
        model.splitIndex = 0;
        model.splitNode = model.children[model.splitIndex];
        model.splitNode.bounds = w._createRangeBounds(model.splitNode.node);
        model.elementBounds = new w._elementBounds(item, '200px');
        var result = w._startSplitText(model, 'asdfasdf asdfasdfasdfadsf asdfasdfasdf', 33);
        expect(item.firstChild.data).toEqual('asdfasdf asdfasdfasdfadsf ');
        expect(item.firstChild.nextSibling.tagName).toEqual('BR');
        expect(item.firstChild.nextSibling.nextSibling.data).toEqual('asdfasdfasdf');
        expect(model.children[model.splitIndex].node.data).toEqual('asdfasdfasdf');
        expect(result).toEqual(true);
        document.body.removeChild(document.body.firstChild);
    });

    it('startSplitTextWith a short guess and break on space default behavior', function () {
        var item = document.createElement('SPAN');
        document.body.insertBefore(item, document.body.firstChild);
        var settings = new TextWrapper.prototype.TextWrapperSettings();
        item.innerHTML = 'asdfasdf asdfasdfasdfadsf asdfasdfasdf';
        var model = new TextWrapper.prototype.TextWrapperModel(item, settings);
        model.children = w._getFlattenedChildren(item);
        model.splitIndex = 0;
        model.splitNode = model.children[model.splitIndex];
        model.splitNode.bounds = w._createRangeBounds(model.splitNode.node);
        model.elementBounds = new w._elementBounds(item, '200px');
        var result = w._startSplitText(model, 'asdfasdf asdfasdfasdfadsf asdfasdfasdf', 17);
        expect(item.firstChild.data).toEqual('asdfasdf asdfasdfasdfadsf ');
        expect(item.firstChild.nextSibling.tagName).toEqual('BR');
        expect(item.firstChild.nextSibling.nextSibling.data).toEqual('asdfasdfasdf');
        expect(model.children[model.splitIndex].node.data).toEqual('asdfasdfasdf');
        expect(result).toEqual(true);
        document.body.removeChild(document.body.firstChild);
    });

    it('startSplitTextWith a very short guess and break on space default behavior', function () {
        var item = document.createElement('SPAN');
        document.body.insertBefore(item, document.body.firstChild);
        var settings = new TextWrapper.prototype.TextWrapperSettings();
        item.innerHTML = 'asdfasdf asdfasdfasdfadsf asdfasdfasdf';
        var model = new TextWrapper.prototype.TextWrapperModel(item, settings);
        model.children = w._getFlattenedChildren(item);
        model.splitIndex = 0;
        model.splitNode = model.children[model.splitIndex];
        model.splitNode.bounds = w._createRangeBounds(model.splitNode.node);
        model.elementBounds = new w._elementBounds(item, '200px');
        var result = w._startSplitText(model, 'asdfasdf asdfasdfasdfadsf asdfasdfasdf', 3);
        expect(item.firstChild.data).toEqual('asdfasdf asdfasdfasdfadsf ');
        expect(item.firstChild.nextSibling.tagName).toEqual('BR');
        expect(item.firstChild.nextSibling.nextSibling.data).toEqual('asdfasdfasdf');
        expect(model.children[model.splitIndex].node.data).toEqual('asdfasdfasdf');
        expect(result).toEqual(true);
        document.body.removeChild(document.body.firstChild);
    });

    it('startSplitTextWith a short guess and no break default behavior', function () {
        var item = document.createElement('SPAN');
        document.body.insertBefore(item, document.body.firstChild);
        var settings = new TextWrapper.prototype.TextWrapperSettings();
        item.innerHTML = 'asdfasdfasdfasdf asdfadsfasdfasdfasdf';
        var model = new TextWrapper.prototype.TextWrapperModel(item, settings);
        model.children = w._getFlattenedChildren(item);
        model.splitIndex = 0;
        model.splitNode = model.children[model.splitIndex];
        model.splitNode.bounds = w._createRangeBounds(model.splitNode.node);
        model.elementBounds = new w._elementBounds(item, '1000px');
        var result = w._startSplitText(model, 'asdfasdfasdfasdf asdfadsfasdfasdfasdf', 3);
        expect(item.firstChild.data).toEqual('asdfasdfasdfasdf asdfadsfasdfasdfasdf');
        expect(result).toEqual(false);
        document.body.removeChild(document.body.firstChild);
    });

    it('startSplitTextWith a short guess and no word break default behavior', function () {
        var item = document.createElement('SPAN');
        document.body.insertBefore(item, document.body.firstChild);
        var settings = new TextWrapper.prototype.TextWrapperSettings();
        item.innerHTML = 'asdfasdfasdfasdf asdfadsfasdfasdfasdf';
        var model = new TextWrapper.prototype.TextWrapperModel(item, settings);
        model.children = w._getFlattenedChildren(item);
        model.splitIndex = 0;
        model.splitNode = model.children[model.splitIndex];
        model.splitNode.bounds = w._createRangeBounds(model.splitNode.node);
        model.elementBounds = new w._elementBounds(item, '1000px');
        var result = w._startSplitText(model, 'asdfasdfasdfasdf asdfadsfasdfasdfasdf', 3);
        expect(item.firstChild.data).toEqual('asdfasdfasdfasdf asdfadsfasdfasdfasdf');
        expect(result).toEqual(false);
        document.body.removeChild(document.body.firstChild);
    });

    it('endSplittext split lock suffix normal behavior', function () {
        var item = document.createElement('SPAN');
        var settings = new TextWrapper.prototype.TextWrapperSettings();
        item.innerHTML = '<span id="1"> a<span id="2">asdf1</span>asdf2</span><span id="2">asdf3</span><span id="3"></span>';
        var model = new TextWrapper.prototype.TextWrapperModel(item, settings);
        model.suffix = document.createElement('SPAN');
        model.suffix.innerHTML = '-';
        model.children = w._getFlattenedChildren(item);
        model.splitIndex = 1;
        model.splitNode = model.children[model.splitIndex];
        model.splitNode.node.parentNode.insertBefore(model.suffix, model.splitNode.node.nextSibling);
        var result = w._endSplitText(model, ' a', ' asdf', true);
        expect(item.firstChild.firstChild.data).toEqual(' a');
        expect(item.firstChild.firstChild.nextSibling.innerHTML).toEqual('-');
        expect(item.firstChild.firstChild.nextSibling.nextSibling.tagName).toEqual('BR');
        expect(item.firstChild.firstChild.nextSibling.nextSibling.nextSibling.data).toEqual('sdf');
        expect(model.children[model.splitIndex].node.data).toEqual('sdf');
        expect(model.suffix).toEqual(null);
        expect(result).toEqual(true);
    });

    it('endSplittext split no lock suffix normal behavior', function () {
        var item = document.createElement('SPAN');
        var settings = new TextWrapper.prototype.TextWrapperSettings();
        item.innerHTML = '<span id="1"> a<span id="2">asdf1</span>asdf2</span><span id="2">asdf3</span><span id="3"></span>';
        var model = new TextWrapper.prototype.TextWrapperModel(item, settings);
        model.suffix = document.createElement('SPAN');
        model.children = w._getFlattenedChildren(item);
        model.splitIndex = 1;
        model.splitNode = model.children[model.splitIndex];
        var result = w._endSplitText(model, ' a', ' asdf', 'hidden');
        expect(item.firstChild.firstChild.data).toEqual(' a');
        expect(item.firstChild.firstChild.nextSibling.tagName).toEqual('BR');
        expect(item.firstChild.firstChild.nextSibling.nextSibling.data).toEqual('sdf');
        expect(model.children[model.splitIndex].node.data).toEqual('sdf');
        expect(model.suffix === null).toEqual(false);
        expect(result).toEqual(true);
    });

    it('endSplittext should insert a break before the node when ' +
        'trimmed length of text that fits is 0 and the node is not ' +
        'the first on a line, and should never lock suffix', function () {
            var item = document.createElement('SPAN');
            var settings = new TextWrapper.prototype.TextWrapperSettings();
            item.innerHTML = '<span id="1">test<span id="2">asdf1</span>asdf2</span><span id="2">asdf3</span><span id="3"></span>';
            var model = new TextWrapper.prototype.TextWrapperModel(item, settings);
            model.suffix = document.createElement('SPAN');
            model.children = w._getFlattenedChildren(item);
            model.splitIndex = 1;
            model.splitNode = model.children[model.splitIndex];
            var result = w._endSplitText(model, ' ', ' asdf', true);
            expect(item.firstChild.firstChild.tagName).toEqual('BR');
            expect(item.firstChild.firstChild.nextSibling.data).toEqual(' asdf');
            expect(model.suffix.style.display).toEqual('none');
            expect(result).toEqual(true);
        });

    it('endSplittext should return false when trimmed length of text that fits' +
        'is 0 and the node is the first on a line, node should be restored to wholeText value' +
        'suffix should not lock', function () {
            var item = document.createElement('SPAN');
            var settings = new TextWrapper.prototype.TextWrapperSettings();
            item.innerHTML = '<span id="1">test<span id="2">asdf1</span>asdf2</span><span id="2">asdf3</span><span id="3"></span>';
            var model = new TextWrapper.prototype.TextWrapperModel(item, settings);
            model.suffix = document.createElement('SPAN');
            model.children = w._getFlattenedChildren(item);
            model.splitIndex = 1;
            model.lastBreakIndex = 1;
            model.splitNode = model.children[model.splitIndex];
            var result = w._endSplitText(model, ' ', ' asdf', true);
            expect(item.firstChild.firstChild.data).toEqual(' asdf');
            expect(model.suffix.style.display).toEqual('none');
            expect(result).toEqual(false);
        });

    it('moveToNextNonChildNode should move splitindex to the next node of the same level', function () {
        var item = document.createElement('SPAN');
        var settings = new TextWrapper.prototype.TextWrapperSettings();
        item.innerHTML = '<span id="1">asdf<span id="2">asdf1</span>asdf2</span><span id="2">asdf3</span><span id="3"></span>';
        var model = new TextWrapper.prototype.TextWrapperModel(item, settings);
        model.children = w._getFlattenedChildren(item);
        model.splitIndex = 2;
        model.splitNode = model.children[model.splitIndex];
        w._moveToNextNonChildNode(model);
        var expectedNode = item.firstChild.lastChild;
        expect(model.splitIndex).toEqual(4);
    });

    it('moveToNextNonChildNode should traverse up when at end of siblings', function () {
        var item = document.createElement('SPAN');
        var settings = new TextWrapper.prototype.TextWrapperSettings();
        item.innerHTML = '<span id="1">asdf<span id="2">asdf1</span>asdf2</span><span id="2">asdf3</span><span id="3"></span>';
        var model = new TextWrapper.prototype.TextWrapperModel(item, settings);
        model.children = w._getFlattenedChildren(item);
        model.splitIndex = 4;
        model.splitNode = model.children[model.splitIndex];
        w._moveToNextNonChildNode(model);
        var expectedNode = item.firstChild.lastChild;
        expect(model.splitIndex).toEqual(5);
    });

    it('movetolastlevelnode should move splitindex to the last node of the same level, without traversing up', function () {
        var item = document.createElement('SPAN');
        var settings = new TextWrapper.prototype.TextWrapperSettings();
        item.innerHTML = '<span id="1">asdf<span id="2">asdf1</span>asdf2</span><span id="2">asdf3</span><span id="3"></span>';
        var model = new TextWrapper.prototype.TextWrapperModel(item, settings);
        model.children = w._getFlattenedChildren(item);
        model.splitIndex = 1;
        model.splitNode = model.children[model.splitIndex];
        w._moveToLastLevelNode(model);
        var expectedNode = item.firstChild.lastChild;
        expect(model.splitIndex).toEqual(4);
    });

    it('movetolastlevelnode should not traverse up when at end of siblings', function () {
        var item = document.createElement('SPAN');
        var settings = new TextWrapper.prototype.TextWrapperSettings();
        item.innerHTML = '<span id="1">asdf<span id="2">asdf1</span>asdf2</span><span id="2">asdf3</span><span id="3"></span>';
        var model = new TextWrapper.prototype.TextWrapperModel(item, settings);
        model.children = w._getFlattenedChildren(item);
        model.splitIndex = 4;
        model.splitNode = model.children[model.splitIndex];
        w._moveToLastLevelNode(model);
        var expectedNode = item.firstChild.lastChild;
        expect(model.splitIndex).toEqual(4);
    });

    it("hideOverflow should hide items remaining in children when called", function () {
        var item = document.createElement('SPAN');
        var settings = new TextWrapper.prototype.TextWrapperSettings();
        item.innerHTML = '<span id="1">asdf<span id="2">asdf</span>asdf</span><span id="2"></span><span id="3"></span>';
        var model = new TextWrapper.prototype.TextWrapperModel(item, settings);
        model.children = w._getFlattenedChildren(item);
        model.splitIndex = 3;
        model.splitNode = model.children[model.splitIndex];
        w._hideOverflow(model, '-');
        var hidespan1 = item.firstChild.firstChild.nextSibling.nextSibling;
        var hidespan2 = item.firstChild.nextSibling;
        expect(hidespan1.tagName).toEqual('SPAN');
        expect(hidespan1.className).toEqual(settings.hiddenClass);
        expect(hidespan1.nextSibling).toEqual(null);
        expect(hidespan2.tagName).toEqual('SPAN');
        expect(hidespan2.className).toEqual(settings.hiddenClass);
        expect(hidespan2.nextSibling).toEqual(null);
    });

    it("add suffix should insert suffix after current splitnode", function () {
        var item = document.createElement('SPAN');
        var settings = new TextWrapper.prototype.TextWrapperSettings();
        item.innerHTML = 'asdf';
        var model = new TextWrapper.prototype.TextWrapperModel(item, settings);
        model.splitNode = { node: item.firstChild };
        w._addSuffix(model, '-');
        expect(item.lastChild.innerHTML).toEqual('-');
        expect(item.lastChild.className).toEqual(settings.suffixClass);
    });

    it("clear formatting should clear suffix breaks and hiding", function () {
        var item = document.createElement('SPAN');
        var settings = new TextWrapper.prototype.TextWrapperSettings();
        var sBreak = '<br class="' + settings.breakClass + '"/>';
        var sHidden = '<span class="' + settings.hiddenClass + '">hidden</span>';
        var sSuffix = '<span class="' + settings.suffixClass + '">suffix</span>';
        item.innerHTML = sSuffix + sBreak + 'asdf<div>asdf</div>asdf' + sBreak + 'asdf<div>asdf</div>' + sHidden;
        var model = new TextWrapper.prototype.TextWrapperModel(item, settings);
        w._clearFormatting(model);
        expect(item.innerHTML).toEqual('asdf<div>asdf</div>asdf asdf<div>asdf</div>hidden');
    });

    it('getSplitestimate should grab the ceiling of the ratio of pixels to trimmed characters to guess the' +
        ' desire character count', function () {
            expect(w._getSplitEstimate(100, '1234567890', 30, 0)).toEqual(7);
            expect(w._getSplitEstimate(100, '1234567890', 35, 0)).toEqual(7);
            expect(w._getSplitEstimate(100, '1234567890', 25, 10)).toEqual(7);
        });

    it("removeBreaks should replace breaks with specified class with a space", function () {
        var item = document.createElement('SPAN');
        item.innerHTML = '<div>How<a> is<br class="test"/>a ra<br/>ven <a>li<br class="test"/>ke a </a>writi<br class="test"/>ng des</a>k?</div>';
        w._removeBreaks(item, 'test');
        expect(item.getElementsByTagName('br').length).toEqual(1);
        expect(item.getElementsByTagName('*').length).toEqual(4);
        expect(item.innerText.replace(/[\r\n]/g, '')).toEqual('How is a raven li ke a writi ng desk?')
    });

    it("removeBreaks should remove breaks after suffixClass, and remove suffix before break", function () {
        var item = document.createElement('SPAN');
        item.innerHTML = '<div>How<a> is<span class="sfx"></span><br class="test"/>a ra<span class="sfx"></span><br/>ven <a>li<span class="sfx"></span><br class="test"/>ke a </a>writi<span class="sfx"></span><br class="test"/>ng des</a>k?</div>';
        w._removeBreaks(item, 'test', 'sfx');
        expect(item.getElementsByTagName('br').length).toEqual(1);
        expect(item.getElementsByTagName('*').length).toEqual(5);
        expect(item.innerText.replace(/[\r\n]/g, '')).toEqual('How isa raven like a writing desk?')
    });

    it('isBoundsChanged should change when element size or position changes', function () {
        var item = document.createElement('SPAN');
        item.innerHTML = '<div style="margin-left:1px;margin-right:2px;border-style:solid;border-left-width:3px;border-right-width:4px;padding-left:5px;padding-right:6px;width:20px;height:10px"></div>';
        document.body.insertBefore(item.firstChild, document.body.firstChild);
        var result = new w._elementBounds(document.body.firstChild);
        result.getBoundingRect();
        expect(w._isBoundsChanged(result)).toEqual(false);
        document.body.firstChild.style.width = '1px';
        expect(w._isBoundsChanged(result)).toEqual(true);
        document.body.firstChild.style.marginLeft = '5px';
        expect(w._isBoundsChanged(result)).toEqual(true);
        expect(w._isBoundsChanged(result, true)).toEqual(true);
        document.body.firstChild.parentNode.removeChild(document.body.firstChild);
    });

    it('wraptextforsize should use a copy of the parent node with styling set to make text measurable', function () {
        var item = document.createElement('SPAN');
        item.className = 'test';
        item.id = 'asdf';
        var textNode = document.createTextNode('testtext');
        item.insertBefore(textNode);
        w._wrapTextForSize(textNode, 'wrapper', true);
        expect(item.firstChild.id).toEqual('asdf');
        expect(item.firstChild.className).toEqual('test wrapper');
        expect(item.tagName).toEqual('SPAN');
    });

    it('getValid split should find the next split', function () {
        var text = '0123456789 1 34 6789';
        expect(w._getValidSplit(text, 11, 0, false, false)).toEqual(''); // beginning of word
        expect(w._getValidSplit(text, 10, 0, false, false)).toEqual(''); // other beginning of word
        expect(w._getValidSplit(text, 12, 0, false, false)).toEqual('0123456789 ');// prev space
        expect(w._getValidSplit(text, 8, 0, true, false)).toEqual('0123456');// force break
        expect(w._getValidSplit(text, 14, 0, true, false)).toEqual('0123456789 1 ') // force break not required
        expect(w._getValidSplit(text, 16, 0, false, true)).toEqual('0123456789 1 34 6789');// end of word
        expect(w._getValidSplit(text, 17, 0, false, true)).toEqual('0123456789 1 34 6789');// other end of word
        expect(w._getValidSplit(text, 6, 0, false, true)).toEqual('0123456789 ');// next space

        expect(w._getValidSplit(text, 6, 6, false, true)).toEqual('0123456');// next w/minwordbreak break
        expect(w._getValidSplit(text, 6, 11, false, true)).toEqual('0123456789 ');// next w/minwordbreak nobreak
        expect(w._getValidSplit(text, 6, 5, false, false)).toEqual('01234');// prev w/minwordbreak break
        expect(w._getValidSplit(text, 5, 5, false, false)).toEqual('');// prev w/minwordbreak nobreak
    });

    it('flattenchildren Should normalize and clean text', function () {
        var item = document.createElement('SPAN');
        item.innerHTML = '<div id="1">\t\r</div><span id="2"></span>  <a id="3">\n </a>';
        var span = item.getElementsByTagName('span')[0];
        var node1 = document.createTextNode('1'), node2 = document.createTextNode('2');
        span.insertBefore(node1, null);
        span.insertBefore(node2, null);
        var result = w._getFlattenedChildren(item);
        expect(result[1].node.data).toEqual(' ');
        expect(result[4].node.data).toEqual(' ');
        expect(result[6].node.data).toEqual(' ');
        expect(node1.data).toEqual('12');
        expect(node2.parentNode).toEqual(null);
    });

    it('flattenchildren Should get In Order From Child To Parent first to last', function () {
        var item = document.createElement('SPAN');
        item.innerHTML = '<div id="1"><span id="2"><a id="3"></a></span></div><div id="4"><span id="5"><a id="6"></a><a id="7"></a></span></div><span id="8"></span>';
        var result = w._getFlattenedChildren(item);
        for (var i = 0; i < 8; i++) {
            expect(result[i].node.id).toEqual('' + (i + 1));
        }
    });
    //this._getBoundsOverlap = getBoundsOverlap;
    it('hidenodes should wrap an element and it siblings including the specified end node', function () {
        var item = document.createElement('SPAN');
        item.innerHTML = '<div id="first"></div><span><br/></span><span id="last"></span><span></span>';
        result = w._hideNodes(item.firstChild, item.lastChild.previousSibling, 'hidden', true);
        expect(result).toEqual(item.firstChild);
        expect(result.nextSibling).toEqual(item.lastChild);
        expect(result.className).toEqual('hidden');
        expect(result.style.display).toEqual('none');
    });

    describe('ElementBounds', function () {
        it("element bounds should correctly reflect styled bounds of element", function () {
            var item = document.createElement('SPAN');
            item.innerHTML = '<div style="margin-left:1px;margin-right:2px;border-style:solid;border-left-width:3px;border-right-width:4px;padding-left:5px;padding-right:6px;width:20px;height:10px"></div>';
            document.body.insertBefore(item, document.body.firstChild);
            var result = new w._elementBounds(item.firstChild);
            expect(result.getMarginLeft()).toEqual(1);
            expect(result.getMarginRight()).toEqual(2);
            expect(result.getBorderLeft()).toEqual(3);
            expect(result.getBorderRight()).toEqual(4);
            expect(result.getPaddingLeft()).toEqual(5);
            expect(result.getPaddingRight()).toEqual(6);

            var rect = result.getBoundingRect();
            expect(rect.left).toEqual(1);
            expect(rect.right).toEqual(19 + 20);

            expect(result.getInnerLeft()).toEqual(9);
            expect(result.getInnerRight()).toEqual(29);
            expect(result.getInnerWidth()).toEqual(20);
            expect(result.getOuterLeft()).toEqual(0);
            expect(result.getOuterRight()).toEqual(41);
            expect(result.getOuterWidth()).toEqual(41);
            expect(result.getBorderWidth()).toEqual(38);
            document.body.removeChild(document.body.firstChild);
        });

        it("element bounds should correctly reflect static width option", function () {
            var item = document.createElement('SPAN');
            item.innerHTML = '<div style="margin-left:1px;margin-right:2px;border-style:solid;border-left-width:3px;border-right-width:4px;padding-left:5px;padding-right:6px;width:30px;height:10px"></div>';
            var result = new w._elementBounds(item.firstChild, '20px');
            document.body.insertBefore(item.firstChild, document.body.firstChild);
            expect(result.getInnerLeft()).toEqual(9);
            expect(result.getInnerRight()).toEqual(29);
            expect(result.getInnerWidth()).toEqual(20);
            document.body.removeChild(document.body.firstChild);
        });

        it("element bounds should correctly reflect percent width option", function () {
            var item = document.createElement('SPAN');
            item.innerHTML = '<div style="margin-left:1px;margin-right:2px;border-style:solid;border-left-width:3px;border-right-width:4px;padding-left:5px;padding-right:6px;width:200px;height:10px"></div>';
            var result = new w._elementBounds(item.firstChild, '10%');
            document.body.insertBefore(item.firstChild, document.body.firstChild);
            expect(result.getInnerLeft()).toEqual(9);
            expect(result.getInnerRight()).toEqual(29);
            expect(result.getInnerWidth()).toEqual(20);
            document.body.removeChild(document.body.firstChild);
        });

        it("element bounds should be recalculated after reset", function () {
            var item = document.createElement('SPAN');
            item.innerHTML = '<div style="width:20px;height:10px"></div>';
            var result = new w._elementBounds(item.firstChild);
            document.body.insertBefore(item.firstChild, document.body.firstChild);
            expect(result.getBorderLeft()).toEqual(0);
            expect(result.getOuterRight()).toEqual(20);
            expect(result.getBorderWidth()).toEqual(20);
            result.resetRect();
            document.body.firstChild.style.width = '30px';
            expect(result.getBorderLeft()).toEqual(0);
            expect(result.getOuterRight()).toEqual(30);
            expect(result.getBorderWidth()).toEqual(30);
            document.body.removeChild(document.body.firstChild);
        });
    });

    it("hideNode should set display to none", function () {
        var item = document.createElement('SPAN');
        w._hideNode(item);
        expect(item.style.display).toEqual('none');
        item.style.cssText = '';
        w._hideNode(item);
        expect(item.style.display).toEqual('none');
    });

    it("hideNode not error on null parameter", function () {
        w._hideNode(null);
    });

    it("showNode", function () {
        var item = document.createElement('SPAN');
        item.style.display = 'none';
        w._showNode(item);
        expect(item.style.display).toEqual('');
        item.style.cssText = 'display:none';
        w._showNode(item);
        expect(item.style.display).toEqual('');
    });

    it("deletenode", function () {
        var item = document.createElement('SPAN');
        item.innerHTML = 'asdf<div><span>asdf</span></div>';
        w._deleteNode(item.firstChild);
        expect(item.innerHTML).toEqual('<div><span>asdf</span></div>');
    });

    it("unwrap should unwrap node and siblings", function () {
        var item = document.createElement('SPAN');
        item.innerHTML = 'asdf<div><span>asdf</span></div>';
        w._unwrap(item.getElementsByTagName('span')[0]);
        expect(item.getElementsByTagName('div').length).toEqual(0);
        expect(item.getElementsByTagName('*').length).toEqual(1);
        expect(item.innerText.replace(/[\r\n]/g, '')).toEqual('asdfasdf')
    });

    it("unwrapInner should unwrap contents of node", function () {
        var item = document.createElement('SPAN');
        item.innerHTML = '<div>asdf<span>asdf<span>asdf</span></span>asdf</div>';
        w._unwrapInner(item.getElementsByTagName('div')[0]);
        expect(item.getElementsByTagName('div').length).toEqual(0);
        expect(item.getElementsByTagName('*').length).toEqual(2);
        expect(item.innerText.replace(/[\r\n]/g, '')).toEqual('asdfasdfasdfasdf')
    });

    it("unwrapInner should remove empty node", function () {
        var item = document.createElement('SPAN');
        item.innerHTML = 'asdf<div></div>';
        w._unwrapInner(item.getElementsByTagName('div')[0]);
        expect(item.getElementsByTagName('div').length).toEqual(0);
        expect(item.getElementsByTagName('*').length).toEqual(0);
        expect(item.innerText.replace(/[\r\n]/g, '')).toEqual('asdf')
    });

    it("removeSpans should unwrap contents of spans of specified class", function () {
        var item = document.createElement('SPAN');
        item.innerHTML = '<div>asdf<span class="test">asdf<span>asdf</span></span>asdf</div>';
        w._removeSpans(item, 'test', true);
        expect(item.getElementsByTagName('span').length).toEqual(1);
        expect(item.getElementsByTagName('*').length).toEqual(2);
        expect(item.innerText.replace(/[\r\n]/g, '')).toEqual('asdfasdfasdfasdf')
    });

    it("removeSpans should delete contents of spans of specified class", function () {
        var item = document.createElement('SPAN');
        item.innerHTML = '<div>asdf<span class="test">asdf<span>asdf</span></span>asdf</div>';
        w._removeSpans(item, 'test');
        expect(item.getElementsByTagName('*').length).toEqual(1);
        expect(item.innerText.replace(/[\r\n]/g, '')).toEqual('asdfasdf');
    });

    describe('insertNewElement', function () {
        it('tagname', function () {
            var element = w._insertNewElement('span');
            expect(element.parentNode).toEqual(null);
            expect(element.tagName).toEqual('SPAN');
            expect(element.className).toEqual('');
            expect(element.innerHTML).toEqual('');
        });

        it('tagname + classname', function () {
            var element = w._insertNewElement('div', 'test');
            expect(element.parentNode).toEqual(null);
            expect(element.tagName).toEqual('DIV');
            expect(element.className).toEqual('test');
            expect(element.innerHTML).toEqual('');
        });

        it('tagname + classname + innerHTML', function () {
            var element = w._insertNewElement('a', 'test', 'inner');
            expect(element.parentNode).toEqual(null);
            expect(element.tagName).toEqual('A');
            expect(element.className).toEqual('test');
            expect(element.innerHTML).toEqual('inner');
        });

        it('tagname + classname + innerHTML + nextSibling + parent', function () {
            var firstNode = document.body.firstChild;
            var element = w._insertNewElement('a', 'test', 'inner', firstNode, document.body);
            expect(element.parentNode).toEqual(document.body);
            expect(element.nextSibling).toEqual(firstNode);
            expect(element.tagName).toEqual('A');
            expect(element.className).toEqual('test');
            expect(element.innerHTML).toEqual('inner');
            document.body.removeChild(document.body.firstChild);
        });
    });

    describe('insertAfterText', function () {
        var element;
        var textNode;
        var newNode

        beforeEach(function () {
            element = document.createElement('span');
            element.innerHTML = '<div>rock <a>me like<div> a</div> hurricane</a> dawg</div>';
            textNode = element.firstElementChild.firstElementChild.firstElementChild.firstChild; //(' a')
            newNode = document.createTextNode('text');
        });

        it('insertAfter should go outside of wrapper if usesRange is false', function () {
            w._insertAfterText(textNode, newNode, false);
            expect(newNode.previousSibling.tagName).toEqual('DIV');
        });

        it('insertAfter should go next to node if usesRange is true', function () {
            w._insertAfterText(textNode, newNode, true);
            expect(newNode.previousSibling.data).toEqual(' a');
        });
    });

    it('rTrim trims ending space from strings', function () {
        var s1 = ' ';
        var s2 = ' || \r';
        var s3 = '||\r\n';
        var s4 = '\t||\t';
        var s5 = '\n|';
        var s6 = '|';
        var s7 = '';
        expect(w._rTrim(s1)).toEqual('');
        expect(w._rTrim(s2)).toEqual(' ||');
        expect(w._rTrim(s3)).toEqual('||');
        expect(w._rTrim(s4)).toEqual('\t||');
        expect(w._rTrim(s5)).toEqual('\n|');
        expect(w._rTrim(s6)).toEqual('|');
        expect(w._rTrim(s7)).toEqual('');
    });

    it('isSpace detects space and non-space characters', function () {
        var s = '| \r\n\t'
        expect(w._isSpace(s, -1)).toEqual(false);
        expect(w._isSpace(s, 5)).toEqual(false);
        expect(w._isSpace(s, 0)).toEqual(false);
        expect(w._isSpace(s, 1)).toEqual(true);
        expect(w._isSpace(s, 2)).toEqual(true);
        expect(w._isSpace(s, 3)).toEqual(true);
        expect(w._isSpace(s, 4)).toEqual(true);
    });

});

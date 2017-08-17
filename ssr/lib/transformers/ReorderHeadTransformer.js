'use strict';

const {isRenderDelayingExtension} = require('../Extensions.js');

class HeadNodes {

  constructor() {
    this._styleAmpRuntime = null;
    this._metaCharset = null;
    this._scriptAmpEngine = null;
    this._metaOther = [];
    this._scriptRenderDelayingExtensions = [];
    this._scriptNonRenderDelayingExtensions = [];
    this._linkIcons = [];
    this._styleAmpCustom = null;
    this._linkStylesheetsBeforeAmpCustom = [];
    this._others = [];
    this._styleAmpBoilerplate = null;
    this._noscript = null;
  }

  register(nodes) {
    nodes.forEach(this._registerNode.bind(this));
  }

  uniquifyAndSortCustomElements() {
    this._scriptRenderDelayingExtensions =
      this._removeDuplicateCustomExtensions(this._scriptRenderDelayingExtensions);
    this._scriptNonRenderDelayingExtensions =
      this._removeDuplicateCustomExtensions(this._scriptNonRenderDelayingExtensions);
  }

  _removeDuplicateCustomExtensions(extensions) {
    const nodesByName = new Map();
    extensions.forEach(node => nodesByName.set(node.hasAttribute('custom-element'), node));
    return Array.from(nodesByName.values());
  }

  appendToHead(head) {
    head.appendChild(this._styleAmpRuntime);
    head.appendChild(this._metaCharset);
    head.appendAll(this._metaOther);
    head.appendChild(this._scriptAmpEngine);
    head.appendAll(this._scriptRenderDelayingExtensions);
    head.appendAll(this._scriptNonRenderDelayingExtensions);
    head.appendAll(this._linkIcons);
    head.appendAll(this._linkStylesheetsBeforeAmpCustom);
    head.appendChild(this._styleAmpCustom);
    head.appendAll(this._others);
    head.appendChild(this._styleAmpBoilerplate);
    head.appendChild(this._noscript);
  }

  _registerNode(node) {
    if (node.tagName === 'meta') {
      this._registerMeta(node);
    } else if (node.tagName === 'script') {
      this._registerScript(node);
    } else if (node.tagName === 'style') {
      this._registerStyle(node);
    } else if (node.tagName === 'link') {
      this._registerLink(node);
    } else if (node.tagName === 'noscript') {
      this._noscript = node;
    } else if (node.tagName) {
      this._others.push(node);
    }
  }

  _registerMeta(node) {
    if (node.attribs.charset) {
      this._metaCharset = node;
      return;
    }
    this._metaOther.push(node);
  }

  _registerScript(node) {
    // Currently there are two amp engine tags: v0.js and
    // amp4ads-v0.js.  According to validation rules they are the
    // only script tags with a src attribute and do not have
    // attributes custom-element or custom-template.  Record the
    // amp engine tag so it can be emitted first among script
    // tags.
    if (node.hasAttribute('src') &&
      !node.hasAttribute('custom-element') &&
      !node.hasAttribute('custom-template')) {
      this._scriptAmpEngine = node;
      return;
    }
    if (node.hasAttribute('custom-element')) {
      if (isRenderDelayingExtension(node)) {
        this._scriptRenderDelayingExtensions.push(node);
        return;
      }
      this._scriptNonRenderDelayingExtensions.push(node);
      return;
    }
    this._others.push(node);
  }

  _registerStyle(node) {
    if (node.hasAttribute('amp-runtime')) {
      this._styleAmpRuntime = node;
      return;
    }
    if (node.hasAttribute('amp-custom')) {
      this._styleAmpCustom = node;
      return;
    }
    if (node.hasAttribute('amp-boilerplate') ||
      node.hasAttribute('amp4ads-boilerplate')) {
      this._styleAmpBoilerplate = node;
      return;
    }
    this._others.push(node);
  }

  _registerLink(node) {
    const rel = node.attribs.rel;
    if (rel === 'stylesheet') {
      if (!this._styleAmpCustom) { // We haven't seen amp-custom yet.
        this._linkStylesheetsBeforeAmpCustom.push(node);
        return;
      }
    }

    if (rel === 'icon' ||
      rel === 'shortcut icon' ||
      rel === 'icon shortcut') {
      this._linkIcons.push(node);
      return;
    }
    this._others.push(node);
  }
}

/**
 * ReorderHeadTransformer - This DOM transformer reorders tags
 * within the head. Specifically, it orders the head like so:
 * (0) <style amp-runtime> (inserted by ServerSideRenderingTransformer)
 * (1) meta charset, then remaining meta tags.
 * (2) AMP runtime .js <script> tag
 * (3) <script> tags for render delaying extensions
 * (4) <script> tags for remaining extensions
 * (5) <link> tag for favicon
 * (6) <link rel=stylesheet> tags before <style amp-custom>
 * (7) <style amp-custom>
 * (8) any other tags allowed in <head>
 * (9) amp boilerplate (first style amp-boilerplate, then noscript).
 */
class ReorderHeadTransformer {

  transform(tree) {
    const html = tree.root.firstChildByTag('html');
    if (!html) {
      return;
    }
    const head = html.firstChildByTag('head');
    if (!head) {
      return;
    }
    const headNodes = new HeadNodes();
    headNodes.register(head.children);
    headNodes.uniquifyAndSortCustomElements();
    head.children = [];
    headNodes.appendToHead(head);
  }

}

module.exports = new ReorderHeadTransformer();
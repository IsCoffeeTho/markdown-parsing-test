import { Parser, Language } from "./treesitter/web-tree-sitter.js";

Parser.init().then(async () => {
	const lang = await Language.load(`/treesitter/langs/markdown.wasm`);
	const parser = new Parser();
	parser.setLanguage(lang);

	console.log("READY");

	const inputPane = document.getElementById("input-pane");
	const outputPane = document.getElementById("output-pane");

	var snapshot = inputPane.value;
	var tree = parser.parse(snapshot);

	function makeEdit() {
		tree = parser.parse(inputPane.value);
		updateOutput();
	}
	inputPane.addEventListener("input", makeEdit);

	function drawTree(node) {
		var treeString = `${node.type}`;
		for (var child of node.children) {
			treeString += `<div class="tree_child">- ${drawTree(child)}</div>`;
		}
		return treeString;
	}

	function updateOutput() {
		function sanitizeCode(c) {
			return c.replace(/\*/g, "&asterisk;").replace(/_/g, "&udscore;").replace(/`/g, "&#96;")
		}
		
		function traverseTree(node) {
			const nodeType = node.type;
			if (nodeType == "inline") {
				return node.text
					.replace(/&/g, `&amp;`)
					.replace(/</g, `&lt;`)
					.replace(/``(([^`\n]+`)+)`/g, (m, c) => `<span class="monospace-inline">${sanitizeCode(c.slice(0, -1).trim())}</span>`)
					.replace(/`([^\n`]+)`/g, (m, c) => `<span class="monospace-inline">${sanitizeCode(c.trim())}</span>`)
					.replace(/\*\*([^*\n]+)\*\*/g, (m, c) => `<strong>${c}</strong>`)
					.replace(/\*([^*\n]+)\*/g, (m, c) => `<em>${c}</em>`)
					.replace(/__([^_\n]+)_/g, (m, c) => `<strong>${c}</strong>`)
					.replace(/_([^_\n]+)_/g, (m, c) => `<em>${c}</em>`)
					.replace(/\[([^\n\]]*)\]\(([^\n )]*)( [^\n)]*)?\)/g, (m, text, link, title) =>
						title ? `<a href="${link}" title="${title}">${text}</a>` : `<a href="${link}">${text}</a>`,
					)
					// .replace(/http:\/\/[^\s]+/g, (m, text, link, title) =>
					// 	title ? `<a href="${link}" title="${title}">${text}</a>` : `<a href="${link}">${text}</a>`,
					// );
			}
			var thisOutput = ``;
			for (var child of node.children) {
				thisOutput += traverseTree(child);
			}

			if (nodeType == "section") {
				return `<div>${thisOutput}</div>`;
			} else if (nodeType == "thematic_break") {
				return `<hr />`;
			} else if (nodeType == "paragraph") {
				return `<p>${thisOutput}</p>`;
			} else if (nodeType == "atx_heading") {
				const markerMap = {
					atx_h1_marker: "h1",
					atx_h2_marker: "h2",
					atx_h3_marker: "h3",
					atx_h4_marker: "h4",
					atx_h5_marker: "h5",
					atx_h6_marker: "h6",
				};
				var headerElem = markerMap[node.child(0).grammarType] ?? "h1";
				return `<${headerElem} id="${node.text
					.replace(/^#+/g, "")
					.trim()
					.replace(/([a-zA-Z0-9])|(.)/g, (m, l, p) => l?.toLowerCase() ?? "-")}">${thisOutput}</${headerElem}>`;
			} else if (nodeType.match(/atx_h\d_marker/)) {
				return "";
			} else if (nodeType == "block_quote") {
				return `<blockquote>${thisOutput}</blockquote>`;
			} else if (nodeType == "block_quote_marker" || nodeType == "block_continuation") {
				return "";
			} else if (nodeType == "list") {
				if (node.child(0).child(0).grammarType == "list_marker_dot") return `<ol>${thisOutput}</ol>`;
				else return `<ul>${thisOutput}</ul>`;
			} else if (nodeType == "list_item") {
				return `<li>${thisOutput}</li>`;
			} else if (nodeType == "indented_code_block" || nodeType == "code_fence_content") {
				var text = node.text;
				if (nodeType == "indented_code_block") {
					text = text.replace(/(^|\n)(\t|    )/g, (m, t) => t ?? "").replace(/\n$/g, "");
				}
				return `<div class="monospace">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</div>`;
			} else if (nodeType == "fenced_code_block") {
				return thisOutput;
			} else if (nodeType == "fenced_code_block_delimiter") {
				return "";
			} else if (nodeType.startsWith("list_marker_")) {
				return "";
			} else if (node.childCount == 0) {
				return node.text.replace(/</g, "&lt;");
			}

			return `<div class="ERROR">${drawTree(node)}</div>`;
		}
		outputPane.innerHTML = traverseTree(tree.rootNode.child(0));
	}

	makeEdit();
});

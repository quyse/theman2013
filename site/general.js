/** Файл поддержки системы модулей в стиле node.js.
 */

window.newModule = function(name, code) {
	var module = {
		exports: {}
	};
	code(module, module.exports);
	window[name] = module.exports;
};

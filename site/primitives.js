/** Выполнить наследование одного класса от другого. */
var inherits = exports.inherits = function(newClass, parentClass) {
    var f = function() {
	};
	f.prototype = parentClass.prototype;
	(newClass.prototype = new f()).constructor = newClass;
};

/** Объект - источник событий. */
var EventEmitter = exports.EventEmitter = function() {
	this.handlers = {};
	this.onceHandlers = {};
};
EventEmitter.prototype.on = function(name, handler) {
	(this.handlers[name] || (this.handlers[name] = [])).push(handler);
};
EventEmitter.prototype.once = function(name, handler) {
	(this.onceHandlers[name] || (this.onceHandlers[name] = [])).push(handler);
};
EventEmitter.prototype.fire = function(name) {
	var args = [];
	for ( var i = 1; i < arguments.length; ++i)
		args.push(arguments[i]);

	var handlers = this.handlers[name];
	if (handlers)
		for ( var i = 0; i < handlers.length; ++i)
			handlers[i].apply(null, args);
	var onceHandlers = this.onceHandlers[name];
	if (onceHandlers && onceHandlers.length) {
		delete this.onceHandlers[name];
		for ( var i = 0; i < onceHandlers.length; ++i)
			onceHandlers[i].apply(null, args);
	}
};

/** Объект, выполняющий ожидание нескольких событий.
 * @param callback {Function} то, что нужно вызвать по выполнению событий.
 */
var WaitForAll = exports.WaitForAll = function(callback) {
	this.callback = callback;
	this.count = 0;
};
/** выполнить проверку выполнения всех событий
 */
WaitForAll.prototype.update = function() {
	if (this.count == 0 && this.callback) {
		this.callback();
		this.callback = null;
	}
};
/** добавить ещё один объект для ожидания
 * @returns {Function} то, что нужно вызвать по окончанию ожидания
 */
WaitForAll.prototype.addWait = function() {
	this.count++;
	var This = this;
	return function() {
		This.count--;
		This.update();
	};
};
/** включить выполнение целевой функции
*/
WaitForAll.prototype.target = function(callback) {
	if (callback)
		this.callback = callback;
	this.update();
};

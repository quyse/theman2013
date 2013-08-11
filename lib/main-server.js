/* Файл - точка входа в приложение - главный сервер.
 */

var express = require('express');
var fs = require('fs');

var config = require('./config');

/** инициализировать сервер
 */
var initialize = function(app, secure) {
	// Конфигурация
	app.configure(function() {
		app.use(express.logger());
		app.use(express.favicon());
		app.use(express.bodyParser());
		app.use(express.cookieParser());
		app.use(app.router);
		app.use(express.static(config.dirs.publicHashed, {
			maxAge: 1000 * 60 * 60 * 24 * 365
		}));
		app.use(express.static(config.dirs.publicFreshed, {
			maxAge: 0
		}));
	});

	return app;
};

// создать HTTP-сервер
initialize(express(), false).listen(config.httpPort);

// обработка ошибок
if (process.env.NODE_ENV == 'production')
	process.on('uncaughtException', function(err) {
		console.log('uncaught', err, err.stack);
	});

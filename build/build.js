/* Скрипт компиляции fortress-chess.
 */

var fs = require('fs');
var ice = require('ice');
var jade = require('jade');
var stylus = require('stylus');
var hashes = require('./hashes');
var js = require('./js');
var meshes = require('./meshes');
var config = require('./config');

// **************** конкретные правила

/**
 * функция, обрабатывающая найденные хеш-зависимости включает копирование этих
 * файлов в publicHashedDir
 */
var processHashDep = function(fileName, hash) {
	ice.make(hashes.hashFileName(publicHashedDir + fileName, hash));
};

/**
 * сформировать правило копирования файлов
 * @param getSource {Function} function(a), возвращающая исходный файл (откуда
 * копировать)
 */
var makeCopyRule = function(getSource) {
	return function(a, file) {
		var source = getSource(a);
		var dest = a[0];
		file.dep(source, function() {
			ice.utils.copyFile(source, dest, function() {
				file.ok();
			});
		});
	};
};

// styl => css: hashes + stylus
ice.rule(new RegExp('^(' + escapedIntermediateDir + '(.+)\\.css)$'), function(a, file) {
	var source = siteDir + a[2] + '.styl';
	var dest = a[1];
	file.dep(source);
	file.waitDeps(function() {
		fs.readFile(source, 'utf8', function(err, data) {
			if (err)
				throw err;
			hashes.resolve(data, intermediateDir, file, function(data) {
				stylus.render(data, {
					compress: config.compressCss
				}, function(err, data) {
					if (err)
						throw err;
					fs.writeFile(dest, data, 'utf8', function(err) {
						if (err)
							throw err;
						file.ok();
					});
				});
			}, processHashDep);
		});
	}, true);
});

// общие скрипты для главных jade
var commonScripts = 'general.js jquery.js gl-matrix.js primitives.js engine.js gamelogic.js game.js main.js';

// index.jade => index.html: hashes + jade
ice.rule(new RegExp('^' + escapedPublicFreshedDir + 'index\\.html$'), function(a, file) {
	var source = siteDir + 'index.jade';
	var dest = a[0];
	file.dep(source);
	file.waitDeps(function() {
		fs.readFile(source, 'utf8', function(err, data) {
			if (err)
				throw err;
			// получить скрипты (тут можно добавить ещё скриптов)
			var scripts = (config.unifyJs ? 'air.all.js' : commonScripts).split(' ');
			// вставить в данные строку со скриптами (она попадёт в комментарий)
			data = data.replace('___SCRIPTS___', scripts.map(function(script) {
				return '<%' + script + '%>';
			}).join(' '));
			// разрешить ссылки
			hashes.resolve(data, intermediateDir, file, function(data) {
				// получить хеш-ссылки на скрипты
				var waiter = new ice.WaitForAll();
				for ( var i = 0; i < scripts.length; ++i)
					(function(i, done) {
						hashes.getFileHash(intermediateDir + scripts[i], function(hash) {
							scripts[i] = hashes.hashFileName(scripts[i], hash);
							done();
						});
					})(i, waiter.wait());
				waiter.target(function() {
					// выполнить рендеринг jade
					data = jade.compile(data)({
						scripts: scripts
					});
					// записать результат
					fs.writeFile(dest, data, 'utf8', function(err) {
						if (err)
							throw err;
						file.ok();
					});
				});
			}, processHashDep);
		});
	}, true);
});

// простые jade => html (независимые от локали)
ice.rule(new RegExp('^(' + escapedPublicFreshedDir + '|' + escapedPublicTemplatesDir + ')(.+)\\.html$'), function(a, file) {
	var source = siteDir + a[2] + '.jade';
	var dest = a[0];
	file.dep(source);
	file.waitDeps(function() {
		fs.readFile(source, 'utf8', function(err, data) {
			if (err)
				throw err;
			// разрешить ссылки
			hashes.resolve(data, intermediateDir, file, function(data) {
				// выполнить рендеринг jade
				data = jade.compile(data)();
				// записать результат
				fs.writeFile(dest, data, 'utf8', function(err) {
					if (err)
						throw err;
					file.ok();
				});
			}, processHashDep);
		});
	}, true);
});

// модели .mesh.png <= .obj
ice.rule(new RegExp('^' + escapedIntermediateDir + '((.+)\\.mesh\\.png)$'), function(a, file) {
	var source = siteDir + a[2] + '.obj';
	var dest = a[0];
	file.dep(source, function() {
		fs.readFile(source, 'utf8', function(err, data) {
			if (err) {
				file.error(err);
				return;
			}
			var data = meshes.parseObj(data);
			data = meshes.pack(data);
			fs.writeFile(dest, data, 'utf8', function(err) {
				if (err) {
					file.error(err);
					return;
				}
				file.ok();
			});
		});
	});
});

//модели (.mesh.js в intermediate)
ice.rule(new RegExp('^' + escapedIntermediateDir + '((.+)\\.mesh\\.js)$'), function(a, file) {
	var source = siteDir + a[2] + '.obj';
	var dest = a[0];
	file.dep(source, function() {
		fs.readFile(source, 'utf8', function(err, data) {
			if (err) {
				file.error(err);
				return;
			}
			var data = meshes.parseObj(data);
			data = 'module.exports=' + JSON.stringify(data);
			data = js.makeModule(data, 'model-' + a[2]);
			if (config.minimizeJs)
				data = js.minimize(data);
			fs.writeFile(dest, data, 'utf8', function(err) {
				if (err) {
					file.error(err);
					return;
				}
				file.ok();
			});
		});
	});
});

// список js, которых не нужно закатывать в модуль
var noModuleJs = {
	jquery: 1,
	general: 1,
	'gl-matrix': 1,
	gamelogic: 1
};

// объединяющие скрипты .all.js
ice.rule(new RegExp('^' + escapedIntermediateDir + '((.*)\\.all\\.js)$'), function(a, file) {
	// скрипты, которые нужно объединить
	var scripts = commonScripts.split(' ');
	// это и есть зависимости
	for ( var i = 0; i < scripts.length; ++i)
		file.dep(siteDir + scripts[i]);
	var dest = a[0];
	file.dep(function() {
		// объединённые данные
		var allData = '';
		// функция шага
		var i = 0;
		var step = function() {
			// если ещё есть файлы
			if (i < scripts.length) {
				// прочитать исходный файл
				var source = siteDir + scripts[i];
				var module = /^(.+)\.js$/.exec(scripts[i])[1];
				fs.readFile(source, 'utf8', function(err, data) {
					if (err)
						throw err;
					// подготовить к объединению или собрать в модуль
					if (noModuleJs[module])
						data = js.prepareToUnify(data);
					else
						data = js.makeModule(data, module);
					// добавить к данным
					allData += data;
					// следующий шаг
					++i;
					step();
				});
			} else {
				// иначе файлы кончились
				// разрешить хеш-ссылки
				hashes.resolve(allData, intermediateDir, file, function(allData) {
					// выполнить минимизацию, если нужно
					if (config.minimizeJs)
						allData = js.minimize(allData);
					// записать файл
					fs.writeFile(dest, allData, 'utf8', function(err) {
						if (err)
							throw err;
						file.ok();
					});
				}, processHashDep);
			}
		};
		// первый шаг
		step();
	});
});

// js копируются в intermediate с опциональным сжатием
ice.rule(new RegExp('^' + escapedIntermediateDir + '((.+)\\.js)$'), function(a, file) {
	var source = siteDir + a[1];
	var dest = a[0];
	file.dep(source, function() {
		fs.readFile(source, 'utf8', function(err, data) {
			if (err)
				throw err;
			if (!noModuleJs[a[2]])
				data = js.makeModule(data, a[2]);
			hashes.resolve(data, intermediateDir, file, function(data) {
				if (config.minimizeJs)
					data = js.minimize(data);
				fs.writeFile(dest, data, 'utf8', function(err) {
					if (err)
						throw err;
					file.ok();
				});
			}, processHashDep);
		});
	});
});

// особый файл locales.json: hashes
ice.rule(new RegExp('^' + escapedPublicTemplatesDir + '(locales\\.json)$'), function(a, file) {
	var source = siteDir + a[1];
	var dest = a[0];
	file.dep(source);
	file.waitDeps(function() {
		fs.readFile(source, 'utf8', function(err, data) {
			if (err)
				throw err;
			// получить список локалей
			var locales = JSON.parse(data).locales;
			for ( var locale in locales) {
				// тут файлы, которые необходимо скомпилировать в зависимости от локали
				// ice.make(publicFreshedDir + 'faq-' + locale + '.html');
			}
			// разрешить ссылки
			hashes.resolve(data, intermediateDir, file, function(data) {
				// записать результат
				fs.writeFile(dest, data, 'utf8', function(err) {
					if (err)
						throw err;
					file.ok();
				});
			}, processHashDep);
		});
	}, true);
});

//картинки и swf тупо копируются в intermediate из siteDir
ice.rule(new RegExp('^' + escapedIntermediateDir + '(.+\\.(jpg|jpeg|png|gif|swf))$'), makeCopyRule(function(a) {
	return siteDir + a[1];
}));

// файлы в publicHashedDir получаются копированием из intermediateDir
ice.rule(new RegExp('^' + escapedPublicHashedDir + hashes.regexpHashFileName + '$'), makeCopyRule(function(a) {
	return hashes.getFileNameByHash(a[1]);
}));

// целевые файлы
ice.make(publicFreshedDir + 'index.html');

//ice.make(intermediateDir + 'tresh.mesh.png');
//ice.make(intermediateDir + 'rocket.mesh.png');

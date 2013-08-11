/* Модуль, выполняющий конвертацию моделей из формата OBJ в JSON.
 * Формат модели:
 * {
 *   vertices: [float'ы, задающие данные вершин],
 *   stride: <размер вершины во float'ах>,
 *   indices: [индексы],
 *   attributes: [{
 *     name: 'position', // имя атрибута, совпадающее с тем, которое в шейдере
 *     size: 3 // размер данных атрибута, в количестве float'ов
 *   }, ...] // атрибуты
 * }
 */

var Canvas = require('canvas');

// разобрать модель в формате OBJ
var parseObj = exports.parseObj = function(str) {
	var lines = str.split('\n');

	// массив позиций, по 3 координаты
	var positions = [];
	// массив нормалей, по 3 координаты
	var normals = [];
	// массив текстурных координат, по 2 координаты
	var texcoords = [];

	var geometries = [];
	var vertices = null; // текущая геометрия

	// обрабатываем файл построчно
	for ( var i = 0; i < lines.length; ++i) {
		var line = lines[i];

		if (line.length <= 0 || line[0] == '#')
			continue;

		if (line[0] == 'v') {
			var a = /[a-z]+\s+(\S+)\s+(\S+)\s+(\S+)/.exec(line);
			if (!a) {
				a = /[a-z]+\s+(\S+)\s+(\S+)/.exec(line);
				if(!a)
					throw new Error('invalid v line: ' + line);
			}
			var x = parseFloat(a[1]);
			var y = parseFloat(a[2]);
			var z = parseFloat(a[3]);

			if (line[1] == ' ') {
				positions.push(x);
				positions.push(y);
				positions.push(z);
			} else if (line[1] == 'n') {
				normals.push(x);
				normals.push(y);
				normals.push(z);
			} else if (line[1] == 't') {
				texcoords.push(x);
				texcoords.push(1 - y);
			}
		} else if (line[0] == 'f') {
			if(vertices == null) {
				vertices = [];
				geometries.push(vertices);
			}

			var a = line.split(' ');
			var vp = [], vn = [], vt = [];
			for ( var j = 1; j <= 3; ++j) {
				var s = a[j].split('/');
				var positionIndex = (parseInt(s[0]) - 1) * 3;
				var texcoordIndex = (parseInt(s[1]) - 1) * 2;
				var normalIndex = (parseInt(s[2]) - 1) * 3;
				vertices.push({
					p: positions.slice(positionIndex, positionIndex + 3),
					n: normals.slice(normalIndex, normalIndex + 3),
					t: texcoords.slice(texcoordIndex, texcoordIndex + 2)
				});
			}
		} else if (line[0] == 'g') {
			vertices = [];
			geometries.push(vertices);
		}
	}

	var newVertices, newIndices;

	// оптимизации делаем, только если у нас один кадр
	if(geometries.length == 1)
	{
		// теперь у нас есть массив vertices
		// выполним оптимизацию
		var indices = [];
		for ( var i = 0; i < vertices.length; ++i)
			indices.push(i);

		newIndices = indices.concat();

		var eps = 1e-8;
		var compareArrays = function(a, b, len) {
			for ( var i = 0; i < len; ++i)
				if (a[i] < b[i] - eps)
					return -1;
				else if (a[i] > b[i] + eps)
					return 1;
			return 0;
		};
		var sorter = function(ai, bi) {
			var a = vertices[ai];
			var b = vertices[bi];
			var c = compareArrays(a.p, b.p, 3);
			if (c != 0)
				return c;
			c = compareArrays(a.n, b.n, 3);
			if (c != 0)
				return c;
			return compareArrays(a.t, b.t, 2);
		};
		indices.sort(sorter);

		// объединить одинаковые индексы, и создать новые вершины
		var newIndicesCount = 0;
		newVertices = [];
		for ( var i = 0; i < indices.length;) {
			var j;
			for (j = i + 1; j < indices.length && sorter(indices[i], indices[j]) == 0; ++j)
				;

			// задать перенумерацию индексов
			var newIndex = newIndicesCount++;
			for ( var k = i; k < j; ++k)
				newIndices[indices[k]] = newIndex;

			// добавить данные вершины
			var index = indices[i];
			newVertices.push(vertices[index].p[0]);
			newVertices.push(vertices[index].p[1]);
			newVertices.push(vertices[index].p[2]);
			newVertices.push(vertices[index].n[0]);
			newVertices.push(vertices[index].n[1]);
			newVertices.push(vertices[index].n[2]);
			newVertices.push(vertices[index].t[0]);
			newVertices.push(vertices[index].t[1]);

			i = j;
		}
	} else {
		// иначе есть несколько кадров
		// ничего не оптимизируем
		// объединяем вершины, создаём индексы
		newVertices = [];
		newIndices = [];
		var frameSize = undefined;
		for(var i = 0; i < geometries.length; ++i) {
			var geometry = geometries[i];
			if(frameSize === undefined)
				frameSize = geometry.length;
			else if(frameSize != geometry.length)
				throw "different frame sizes";
			for(var j = 0; j < geometry.length; ++j) {
				var vertex = geometry[j];
				newVertices.push(vertex.p[0]);
				newVertices.push(vertex.p[1]);
				newVertices.push(vertex.p[2]);
				newVertices.push(vertex.n[0]);
				newVertices.push(vertex.n[1]);
				newVertices.push(vertex.n[2]);
				newVertices.push(vertex.t[0]);
				newVertices.push(vertex.t[1]);
			}
			if(i == 0)
				for(var j = 0; j < geometry.length; ++j)
					newIndices.push(j);
		}
	}

	// вернуть модель
	return {
		vertices: newVertices,
		indices: newIndices,
		framesCount: geometries.length,
		attributes: [{
			name: 'aPosition',
			size: 3
		}, {
			name: 'aNormal',
			size: 3
		}, {
			name: 'aTexcoord',
			size: 2
		}]
	};
};

// сохранить модель в картинку
var pack = exports.pack = function(model) {
	// размер заголовка (включающего в себя uint32 количество кадров, uint32 размер данных вершин, и unit32 количество индексов)
	var headerSize = 12;
	// получить размер вершин
	var verticesSize = model.vertices.length * 4;
	// получить размер индексов
	var indicesSize = model.indices.length * 2;

	// создать массив
	var bufferSize = headerSize + verticesSize + indicesSize;
	var buffer = new ArrayBuffer(bufferSize);
	// скопировать в него данные
	(new Uint32Array(buffer, 0, 3)).set([model.framesCount, model.vertices.length, model.indices.length]);
	(new Float32Array(buffer, headerSize, model.vertices.length)).set(model.vertices);
	(new Uint16Array(buffer, headerSize + verticesSize, model.indices.length)).set(model.indices);

	// вычислить подходящие размеры картинки
	// картинка будет формата RGBA, то есть по 4 байта на пиксел
	// но мы используем только байты RGB, а в A будем записывать 255
	// так как PNG сохраняется как premultiplied-alpha, то запись в A
	// искажает значения
	var size = Math.ceil(bufferSize / 3);
	var width = Math.ceil(Math.sqrt(size));
	var height = Math.ceil(size / width);

	// создать картинку
	var canvas = new Canvas(width, height);
	var context = canvas.getContext('2d');
	var imageData = context.createImageData(width, height);
	var imageDataData = imageData.data;
	var bufferArray = new Uint8Array(buffer);
	var i = 0, j = 0;
	while (i < bufferSize) {
		for ( var k = 0; k < 3 && i < bufferSize; ++k)
			imageDataData[j++] = bufferArray[i++];
		imageDataData[j++] = 255;
	}
	for (; j < imageDataData.length; ++j)
		imageDataData[j] = 255;
	// нарисовать её
	context.putImageData(imageData, 0, 0, 0, 0, width, height);

	// сохранить её в PNG
	return canvas.toBuffer();
};

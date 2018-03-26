const convert = require('xml-js');
const csv = require('fast-csv');
const fs = require('fs');
const _ = require('lodash');

(async function() {
	if (process.argv.length < 3) {
		console.error('Missing parameters');
		console.error('Usage: node app.js points_file [links_file]');
		return;
	}
	try {
		// read points and links
		let points = await readPoints();
		console.log(`Read ${Object.keys(points).length} points`);
		let links = await readLinks();
		console.log(`Read ${links.length} links`);
		// read starting template
		let template = readTemplate();
		let document = template.elements[0].elements[0];

		// group points
		let groups = {}
		_.forEach(points, (value, key) => {
			if (!groups[value.group]) groups[value.group] = [];
			groups[value.group].push(value);
		});
		if (groups.lenght > 6) {
			console.error('Max 6 groups are supported');
			return;
		}
		// add points to the document
		let groupIdx = 1;
		_.forEach(groups, value => {
			document.elements.push(generatePointFolder(value, groupIdx));
			groupIdx++;
		});

		// add links to the document
		document.elements.push(generateLinksFolder(links, points));

		// save result
		//let output = JSON.stringify(document, null, '\t');
		let output = convert.js2xml(template, {spaces: '\t'});
		fs.writeFileSync('output.kml', output, 'utf8');
		console.log('Generated output.kml');
	} catch (err) {
		console.error(err);
	}
})();

async function readPoints() {
	return new Promise((resolve, reject) => {
		let points = {};
		let pointsFilename = process.argv[2];
		csv.fromPath(pointsFilename, {
			objectMode: true,
			headers: ['id', 'group', 'x', 'y', 'desc']
		})
		.on('data', data => points[data.id] = data)
		.on('end', () => resolve(points))
		.on('error', err => reject(err));
	});
}

async function readLinks() {
	return new Promise((resolve, reject) => {
		let links = [];
		let linksFilename = process.argv[3];
		if (!linksFilename) {
			resolve([]);
			return;
		}
		csv.fromPath(linksFilename, {
			objectMode: true,
			headers: ['id1', 'id2', 'desc']
		})
		.on('data', data => links.push(data))
		.on('end', () => resolve(links))
		.on('error', err => reject(err));
	});
}

function readTemplate() {
	const src = fs.readFileSync('template.xml', 'utf8');
	return convert.xml2js(src);
}

// generate a KML folder
function generateFolder(name, elements) {
	elements.push(convert.xml2js(`<name>${name}</name>`).elements[0]);
	return {
		"type": "element",
		"name": "Folder",
		"elements": elements
	}
}

// generate a KML folder from a group of points
function generatePointFolder(group, groupIdx) {
	let elements = [];
	_.forEach(group, (value) => {
		elements.push(generatePoint(value, groupIdx));
	});
	return generateFolder('Group ' + group[0].group, elements);
}

// generate a KML folder from a group of links
function generateLinksFolder(links, points) {
	let elements = [];
	_.forEach(links, link => {
		elements.push(generateLine(
			`${link.id1}-${link.id2}`,
			link.desc,
			points[link.id1].x,
			points[link.id1].y,
			points[link.id2].x,
			points[link.id2].y
		));
	});
	return generateFolder('Links', elements);
}

// generate a KML point from a group of points
function generatePoint(point, groupIdx) {
	let xml = `
		<Placemark>
			<name>${point.id}</name>
			<description>${point.desc}</description>
			<styleUrl>#pin${groupIdx}</styleUrl>
			<Point>
				<coordinates>${point.x},${point.y},0</coordinates>
			</Point>
		</Placemark>
	`;
	return convert.xml2js(xml).elements[0];
}

// generate a KML line between two points
function generateLine(name, desc, x1, y1, x2, y2) {
	let xml = `
		<Placemark>
			<name>${name}</name>
			<description>${desc}</description>
			<styleUrl>#red-line</styleUrl>
			<LineString>
				<tessellate>1</tessellate>
				<coordinates>
					${x1},${y1},0 ${x2},${y2},0 
				</coordinates>
			</LineString>
		</Placemark>
	`;
	return convert.xml2js(xml).elements[0];
}

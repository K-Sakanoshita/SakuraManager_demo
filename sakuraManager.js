// SakuraManager Main Script.
// copyright by K.Sakanoshita / Licence: MIT
"use strict";

// Global Variable
const CATEGORY = { 'サクラ': './images/sakura.png', 'ソメイヨシノ': './images/sakura.png', 'シダレザクラ': './images/shidare.png' };
const Tile1 = {	url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
				attr: { attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a>', maxNativeZoom: 19, maxZoom: 21, }};
const bounds_all = [[36.18776, 136.31146], [36.1400, 136.3633]];
const LocateOpts = {	position: 'topleft', flyTo: true, icon: "fa fa-map-marker pt-1",
						strings: { title: "クリックすると現在地を取得します", outsideMapBoundsMsg: "竹田地区内でのみ現在地取得ができます。" }};
const OvServer = 'https://overpass.kumi.systems/api/interpreter'	// or 'https://overpass-api.de/api/interpreter' or 'https://overpass.nchc.org.tw/api/interpreter'
const OvQuery = [	'node["species"="Cherry blossom"]', '; node["species:en"="Cherry blossom"]',
					'; node["species"="Cerasus itosakura"]', '; node["species:en"="Cerasus itosakura"]',
					'; node["species"="Cerasus × yedoensis"]', '; node["species:en"="Cerasus × yedoensis"]'];
const FILES = ['modals.html'];

var map, hash;

// main prosess
$(document).ready(function () {
	$.ajaxSetup({ cache: false });

	console.log("initialize frontend.");
	let jqXHRs = [];
	for (let key in FILES) { jqXHRs.push($.get(FILES[key])) };
	$.when.apply($, jqXHRs).always(function () {
		$("#Modals").html(arguments[0]);						// メニューHTML読み込み
	});

	let osm = L.tileLayer(Tile1.url, Tile1.attr);
	map = L.map('mapid', { center: [36.1669, 136.3318], zoom: 15, layers: [osm], zoomControl: false, maxBounds: bounds_all, preferCanvas: true });
	L.control.zoom({ position: 'topleft' }).addTo(map);
	hash = new L.Hash(map);
	L.control.locate(LocateOpts).addTo(map);

	Marker.init(CATEGORY, { iconSize: [24, 24] });		// アイコン初期化
	PoiData.get().then(function () {					// POI情報を元にアイコン表示
		DataList.view();
	});
});

// General function

function formatDate(date, format) {
	// date format
	format = format.replace(/YYYY/g, date.getFullYear());
	format = format.replace(/YY/g, date.getFullYear().toString().slice(-2));
	format = format.replace(/MM/g, ('0' + (date.getMonth() + 1)).slice(-2));
	format = format.replace(/DD/g, ('0' + date.getDate()).slice(-2));
	format = format.replace(/hh/g, ('0' + date.getHours()).slice(-2));
	format = format.replace(/mm/g, ('0' + date.getMinutes()).slice(-2));
	format = format.replace(/ss/g, ('0' + date.getSeconds()).slice(-2));
	return format;
};

function divideArray(arr, n) {
	// Divide array into n pieces
	let arrList = [];
	let idx = 0;
	while (idx < arr.length) {
		arrList.push(arr.splice(idx, idx + n));
	}
	return arrList;
};

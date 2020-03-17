// SakuraManager Class Library Script.
// copyright by K.Sakanoshita / Licence: MIT
"use strict";

var Marker = (function () {
	// マーカー操作
	const PointUp = { radius: 6, color: 'blue', fillColor: '#000080', fillOpacity: 0.2 };
	var elements, markers, latlngs;	// Google Spreadsheetのデータ、マーカー群、OSMIDとlatlngのリスト
	var markerIcon = {};			// アイコンの設定値(init時に設定)

	return {
		init: function (category, options) {
			let LeafIcon = L.Icon.extend({ "options": options });
			Object.keys(category).forEach(name => markerIcon[name] = new LeafIcon({ iconUrl: category[name] }));
		},
		reset: function () {
			if (markers != undefined) {
				markers.forEach( (marker) => map.removeLayer(marker));
			};
			markers = [];
			elements = {};
			latlngs = {};
		},
		set: function (json) {		// マーカーを追加
			json.forEach(function (datas) {
				let osmid = datas["OSMID"]
				elements[osmid] = datas;
				let icon = markerIcon[datas['種別']] == undefined ? '' : { icon: markerIcon[datas['種別']] };
				markers[osmid] = L.marker([datas['緯度'], datas['経度']], icon)
					.addTo(map).on('click', e => PoiData.form_edit(elements[e.target.sakura_osmid]));
				markers[osmid].sakura_osmid = datas["OSMID"];
				latlngs[datas["OSMID"]] = [datas['緯度'], datas['経度']];
			});
		},
		center: function (OSMID) {
			map.panTo(latlngs[OSMID]);
			let circle = L.circle(latlngs[OSMID], PointUp ).addTo(map);
			setTimeout( () => map.removeLayer(circle), 5000);
		}
	};
})();

var PoiData = (function () {
	// Poi操作
	const GET_Url = "https://script.google.com/macros/s/AKfycbx689YdmNnYekYuAXuy2oHyu7pMr_mIONISYSVjXPXwXJytR9I/exec";
	const POST_Ok = "登録に成功しました。";
	const POST_Ng = "登録エラーです。もう一度やり直してください。";
	const UPDT_NW = "OpenStreetMapから桜データを取得・更新中です。";
	const UPDT_ok = "桜データの取得・更新処理が終了しました。";
	var POIs = [];			// 管理対象のPOIたち(PoiData.get終了時に更新)

	return {
		poi: function () {
			return POIs;	
		},

		get: function () {					// サーバーからデータを収集する
			return new Promise(function (resolve, reject) {
				$.ajax({ type: "get", url: GET_Url, dataType: "jsonp", cache: false, jsonpCallback: 'GDocReturn' }).then(function (json) {
					Marker.reset();
					Marker.set(json);
					POIs = json;
					resolve();
				}, function (json) {
					alert(POST_Ng);
					POIs = [];
					reject(json);
				});
			});
		},

		set: function (commit, silent) {	// サーバーにデータを投稿する(1件)
			return new Promise(function (resolve, reject) {
				let jsonp = JSON.stringify([commit]);
				jsonp = jsonp.replace(/\?/g, '？');
				jsonp = jsonp.replace(/\&/g, '＆');
				$.ajax({ "type": "get", "url": GET_Url + '?json=' + jsonp, dataType: "jsonp", cache: false, jsonpCallback: 'GDocReturn' }).then( json => {
					if (!silent) alert(POST_Ok);
					Marker.reset();
					Marker.set(json);
					POIs = json;
					resolve();
				}, json => {
					if (!silent) alert(POST_Ng);
					POIs = [];
					reject(json);
				});
			});
		},

		sets: function (commits) {			// サーバーにデータを投稿する(複数)
			return new Promise(function (resolve, reject) {
				$.ajax({ "type": "get", "url": GET_Url + '?json=' + JSON.stringify(commits), cache: false }).then(function () {
					resolve();
				}, function (json) {
					reject(json);
				});
			});
		},

		update: function (query) {	// OSM overpass qlをもとにPOIデータを取得
			return new Promise(function (resolve, reject) {
				let maparea = '(' + bounds_all[1][0] + ',' + bounds_all[0][1] + ',' + bounds_all[0][0] + ',' + bounds_all[1][1] + ')';
				let ovpass = OvServer + '?data=[out:json][timeout:25];(';
				for (let q in query) ovpass += query[q] + maparea;
				ovpass += ';); out;>; out skel qt;';
				console.log(ovpass);

				ProgressBar.show(0);
				ProgressBar.button(false);
				ProgressBar.message(UPDT_NW);
				$.get(ovpass).done(function (data) {
					let task = [];
					data.elements.forEach(function (ele) {
						let same = POIs.filter(poi => poi.OSMID == ele.id);
						if (same.length == 0) {		// 重複が無い場合(新規登録)
							let commit = { 'OSMID': ele.id, '緯度': ele.lat, '経度': ele.lon, '種別': ele.tags['species:ja'] };
							task.push(commit);
						};
					});

					let tasks = divideArray(task, 10);	// taskを30個毎にまとめたtasksを作る
					let idx = 0;
					let maxidx = tasks.length;
					update_loop(tasks, idx, maxidx, function () {
						ProgressBar.message(UPDT_ok);
						ProgressBar.button(true);
					});
				});
			})
		},

		form_edit: function (json) {
			DataList.select(json['OSMID']);
			$("#osmid").html(json['OSMID']);
			$("#area").val(json['場所']);
			$("#planting").val(formatDate(new Date(json['植樹日']), "YYYY-MM-DD"));
			$("#name").val(json['愛称']);
			$("#picture_url").val(json['写真アドレス']);

			let picurl = json['写真アドレス'];
			let pattern = new RegExp('^(https?:\\/\\/)?((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|((\\d{1,3}\\.){3}\\d{1,3}))(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*(\\?[;&a-z\\d%_.~+=-]*)?(\\#[-a-z\\d_]*)?$', 'i');
			if (pattern.test(picurl) && picurl !== "") {
				console.log("picture url is valid");
				$("#picture_img").attr('src', picurl);
				$("#picture_img").show();
			} else {
				console.log("picture url is invalid");
				$("#picture_img").attr('src', "");
				$("#picture_img").hide();
			};
			$("#memo").val(json['メモ']);
			$('#PoiEdit_Modal').modal({ backdrop: false, keyboard: false });
		},

		form_save: function (callback) {
			let commit = {};
			if (confirm("この内容で登録しますか？")) {
				$('#PoiEdit_Button').hide();
				commit['index'] = $('#index').val();
				commit['OSMID'] = $('#osmid').html();
				commit['場所'] = $('#area').val();
				commit['植樹日'] = $('#planting').val().replace(/-/g, "/");
				commit['愛称'] = $('#name').val();
				commit['写真アドレス'] = $('#picture_url').val();
				commit['メモ'] = $('#memo').val();
				console.log(commit);
				PoiData.set(commit, false).then(() => callback());
			};
			$('#PoiEdit_Modal').modal("hide");
			return;
		}
	}

	// tasks内を1件ずつ同期する再帰処理
	function update_loop(tasks, idx, maxidx, calllback) {
		console.log("update_loop: " + idx + "/" + maxidx);
		ProgressBar.show(Math.ceil(idx / maxidx) * 100);
		PoiData.sets(tasks[idx++]).then(function () {
			if (idx < maxidx) update_loop(tasks, idx, maxidx,calllback);
		});
		calllback();
	};


	/* Classの内容を整えて本体の登録関数を呼び出す */
	function PopUpSubmit() {

	};
})();

var DataList = (function () {
	// PoiDatalist管理
	var table;

	return {
		table: function () {
			return table;	
		},

		view: function () {		// PoiDataのリスト表示

			if (table !== undefined) {
				table.off('select');
				table.destroy();
			};

			let result = PoiData.poi().map(function (poi) {
				return {"OSMID": poi["OSMID"],	"Update": formatDate(new Date(poi["更新日"]), "YY/MM/DD"),"Name": poi["愛称"],"Memo": poi["メモ"]	};
			});
			console.log(result);
			table = $('#tableid').DataTable({
				"autoWidth": true,
				"columns": [{ title: "OSMID", data: "OSMID" },{ title: "更新日", data: "Update" },{ title: "愛称", data: "Name" },{ title: "メモ", data: "Memo" }],
				"data": result,
				"processing": true,
				"filter": false,
				"destroy": true,
				"deferRender": true,
				"dom": 't',
				"ordering": false,
				"orderClasses": false,
				"paging": true,
				"processing": false,
				"pageLength": 100000,
				"select": true,
				"scrollCollapse": true,
				"scrollY": $("#dataid").height() + "px"
			});

			table.on('select', function (e, dt, type, indexes) {
				if (type === 'row') {
					var data = table.rows(indexes).data();
					console.log(data[0]);
					Marker.center(data[0].OSMID);
					// do something with the ID of the selected items
				}
			});
		},

		select: function (OSMID) {	// アイコンをクリックした時にデータを選択
			table.rows().deselect();
			let index = table.column(0).data().indexOf(parseInt(OSMID));
			if (index >= 0) {
				table.row(index).select();
				table.row(index).node().scrollIntoView(true);
			}
		}
	}
})();

var ProgressBar = (function () {
	// Progress Bar
	return {
		show: function (percent) {
			$('#Progress_Bar').css('width', parseInt(percent) + "%");
			$('#Progress_Modal').modal({ backdrop: "static", keyboard: false });
		},
		message: function (message) {
			$("#Progress_Message").html(message);
		},
		hide: function () {
			$("#Progress_Message").html("");
			$('#Progress_Bar').css('width', "0%");
			$('#Progress_Modal').modal("hide");
		},
		button: function (view) {
			if (view) {
				$("#Progress_Button").removeClass('d-none');
			} else {
				$("#Progress_Button").removeClass('d-none');
				$("#Progress_Button").addClass('d-none');
			};
		}
	}
})();



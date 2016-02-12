var NEM_EPOCH = Date.UTC(2015, 2, 29, 0, 6, 25, 0);
var _hexEncodeArray = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];

function hex2ua_reversed(hexx) {
	var hex = hexx.toString();//force conversion
	var ua = new Uint8Array(hex.length / 2);
	for (var i = 0; i < hex.length; i += 2) {
		ua[ua.length - 1 - (i / 2)] = parseInt(hex.substr(i, 2), 16);
	}
	return ua;
};

function ua2hex(ua) {
	var s = '';
	for (var i = 0; i < ua.length; i++) {
		var code = ua[i];
		s += _hexEncodeArray[code >>> 4];
		s += _hexEncodeArray[code & 0x0F];
	}
	return s;
};
	
function hex2ua (hexx) {
	var hex = hexx.toString();//force conversion
	var ua = new Uint8Array(hex.length / 2);
	for (var i = 0; i < hex.length; i += 2) {
		ua[i / 2] = parseInt(hex.substr(i, 2), 16);
	}
	return ua;
};

function serializeTransferTransaction (entity) {

	var r = new ArrayBuffer(512 + 2764);
	var d = new Uint32Array(r);
	var b = new Uint8Array(r);
	d[0] = entity['type'];
	d[1] = entity['version'];
	d[2] = entity['timeStamp'];

	var temp = hex2ua(entity['signer']);
	d[3] = temp.length;
	var e = 16;
	for (var j = 0; j<temp.length; ++j) { b[e++] = temp[j]; }

	// Transaction
	var i = e / 4;
	d[i++] = entity['fee'];
	d[i++] = Math.floor((entity['fee'] / 0x100000000));
	d[i++] = entity['deadline'];
	e += 12;

	d[i++] = entity['recipient'].length;
	e += 4;
	// TODO: check that entity['recipient'].length is always 40 bytes
	for (var j = 0; j < entity['recipient'].length; ++j) {
		b[e++] = entity['recipient'].charCodeAt(j);
	}
	i = e / 4;
	d[i++] = entity['amount'];
	d[i++] = Math.floor((entity['amount'] / 0x100000000));
	e += 8;

	if (entity['message']['type'] === 1 || entity['message']['type'] === 2) {
		var temp = hex2ua(entity['message']['payload']);
		if (temp.length === 0) {
			d[i++] = 0;
			e += 4;
		} else {
			// length of a message object
			d[i++] = 8 + temp.length;
			// object itself
			d[i++] = entity['message']['type'];
			d[i++] = temp.length;
			e += 12;
			for (var j = 0; j<temp.length; ++j) { b[e++] = temp[j]; }
		}
	}

	var entityVersion = d[1] & 0xffffff;
	if (entityVersion >= 2) {
		var temp = o._serializeMosaics(entity['mosaics']);
		for (var j = 0; j<temp.length; ++j) { b[e++] = temp[j]; }
	}
	return new Uint8Array(r, 0, e);
}

function CALC_MIN_FEE(numNem) {
	return Math.ceil(Math.max(10 - numNem, 2, Math.floor(Math.atan(numNem / 150000.0) * 3 * 33)));
}

var CURRENT_NETWORK_ID = 96;
var CURRENT_NETWORK_VERSION = function(val) {

	if (CURRENT_NETWORK_ID === 104) {
		return 0x68000000 | val;
	} else if (CURRENT_NETWORK_ID === -104) {
		return 0x98000000 | val;
	}
	return 0x60000000 | val;
};

function sendAjaxRequest(){

	var amount = parseInt(10 * 1000000, 10);
	var message = {payload:"",type:1};
	var due = 60;
	var mosaics = null;
	var mosaicsFee = null;

	var timeStamp = Math.floor((Date.now() / 1000) - (NEM_EPOCH / 1000));
	var msgFee = message.payload.length ? Math.max(1, Math.floor(message.payload.length / 2 / 16)) * 2 : 0;
	var fee = mosaics ? mosaicsFee : CALC_MIN_FEE(amount / 1000000);
	var totalFee = (msgFee + fee) * 1000000;

	var data ={
		'type': 0x101,
		'version': CURRENT_NETWORK_VERSION(1),
		'signer': SENDER_PUBLIC_KEY,
		'timeStamp': timeStamp,
		'deadline': timeStamp + due * 60
	};

	var custom = {
		'recipient': RECIPIENT_ADDRESS,
		'amount': amount,
		'fee': totalFee,
		'message': message,
		'mosaics': mosaics
	};

	var entity = $.extend(data, custom);
	var result = serializeTransferTransaction(entity);
	var kp = KeyPair.create(SENDER_PRIVATE_KEY);  
	var signature = kp.sign(result);
	var obj = {'data':ua2hex(result), 'signature':signature.toString()};
	console.log(entity);
	console.log(result);
	console.log(obj);

	return $.ajax({
		url: URL_TRANSACTION_ANNOUNCE  ,
		type: 'POST',
		contentType:'application/json',
		data: JSON.stringify(obj)  ,
		error: function(XMLHttpRequest) {
			console.log( $.parseJSON(XMLHttpRequest.responseText));
		}
	});
}


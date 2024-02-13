import stream from 'stream-browserify';
import zlib from 'browserify-zlib';
import createBrotliDecompress from 'create-brotli-decompress';
import mimicResponse from "@esm2cjs/mimic-response";

export default function decompressResponse(response) {
	const contentEncoding = (response.headers['content-encoding'] || '').toLowerCase();

	if (!['gzip', 'deflate', 'br'].includes(contentEncoding)) {
		return response;
	}

	delete response.headers['content-encoding'];

	let isEmpty = true;

	function handleContentEncoding(data) {
		const decompressStream = contentEncoding === 'br'
			? createBrotliDecompress()
			: ((contentEncoding === 'deflate' && data.length > 0 && (data[0] & 0x08) === 0) // eslint-disable-line no-bitwise
				? zlib.createInflateRaw()
				: zlib.createUnzip());

		decompressStream.once('error', error => {
			if (isEmpty && !response.readable) {
				finalStream.end();
				return;
			}

			finalStream.destroy(error);
		});

		checker.pipe(decompressStream).pipe(finalStream);
	}

	const checker = new stream.Transform({
		transform(data, _encoding, callback) {
			if (isEmpty === false) {
				callback(null, data);
				return;
			}

			isEmpty = false;

			handleContentEncoding(data);

			callback(null, data);
		},

		flush(callback) {
			callback();
		},
	});

	const finalStream = new stream.PassThrough({
		autoDestroy: false,
		destroy(error, callback) {
			response.destroy();

			callback(error);
		},
	});

	mimicResponse(response, finalStream);
	response.pipe(checker);

	return finalStream;
}

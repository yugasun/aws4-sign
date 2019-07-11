## aws4-sign

[![Build Status](https://travis-ci.org/yugasun/aws4-sign.svg?branch=master)](https://travis-ci.org/yugasun/aws4-sign)
<a href="https://www.npmjs.com/package/aws4-sign"><img src="https://img.shields.io/npm/dm/aws4-sign.svg" alt="Downloads"></a>
<a href="https://www.npmjs.com/package/aws4-sign"><img src="https://img.shields.io/npm/v/aws4-sign.svg" alt="Version"></a>

AWS Signature Version 4 for node.js and browser.

> Notice: this project is rewrote from [aws4](https://github.com/mhart/aws4) by
> ES6 for using on demand.

## Installation

```bash
npm install aws4-sign --save
# or
yarn add aws4-sign
```

## Example

### Use in browser

```html
<script src="https://unpkg.com/aws4-sign"></script>
<script>
    var sigs = Aws4Sign.sign(
        {
            service: 's3',
            path: '/../../whatever?X-Amz-Expires=1234',
            signQuery: true,
        },
        { accessKeyId: 'a', secretAccessKey: 'b' },
    );
</script>
```

### Use in Node.js

```javascript
const http = require('http');
const { sign, RequestSigner } = require('aws4-sign');

const opts = {
    host: 'sqs.us-east-1.amazonaws.com',
    path: '/?Action=ListQueues',
};
// assumes AWS credentials are available in process.env
sign(opts, {
    accessKeyId: '<your-access-key-id>',
    secretAccessKey: '<your-secret-access-key>',
});
console.log(opts);
/*
{
  host: 'sqs.us-east-1.amazonaws.com',
  path: '/?Action=ListQueues',
  headers: {
    Host: 'sqs.us-east-1.amazonaws.com',
    'X-Amz-Date': '20121226T061030Z',
    Authorization: 'AWS4-HMAC-SHA256 Credential=ABCDEF/20121226/us-east-1/sqs/aws4_request, ...'
  }
}
*/

// we can now use this to query AWS using the standard node.js http API
http.request(opts, function(res) {
    res.pipe(process.stdout);
}).end();

// Generate CodeCommit Git access password
const signer = new RequestSigner({
    service: 'codecommit',
    host: 'git-codecommit.us-east-1.amazonaws.com',
    method: 'GIT',
    path: '/v1/repos/MyAwesomeRepo',
});
const password = signer.getDateTime() + 'Z' + signer.signature();
```

## API

### aws4.sign(requestOptions, [credentials])

This calculates and populates the `Authorization` header of `requestOptions`,
and any other necessary AWS headers and/or request options. Returns
`requestOptions` as a convenience for chaining.

`requestOptions` is an object holding the same options that the node.js
[http.request](http://nodejs.org/docs/latest/api/http.html#http_http_request_options_callback)
function takes.

The following properties of `requestOptions` are used in the signing or
populated if they don't already exist:

| name                      | default                                                     |
| ------------------------- | ----------------------------------------------------------- |
| hostname/host             | will be determined from `service` and `region`              |
| method                    | `GET`                                                       |
| path                      | `/`                                                         |
| body                      | `''`                                                        |
| service                   | will be calculated from `hostname` or `host`                |
| region                    | `'us-east-1'`                                               |
| domain                    | `'amazonaws.com'`                                           |
| `headers['Host']`         | will use `hostname` or `host` or be calculated if not given |
| `headers['Content-Type']` | `'application/x-www-form-urlencoded; charset=utf-8'`        |
| `headers['Date']`         | `new Date()`                                                |

Your AWS credentials (which can be found in your
[AWS console](https://portal.aws.amazon.com/gp/aws/securityCredentials)) can be
specified in one of two ways:

#### credentials

You can config `credentials`, like below:

```javascript
aws4.sign(requestOptions, {
    secretAccessKey: '<your-secret-access-key>',
    accessKeyId: '<your-access-key-id>',
    sessionToken: '<your-session-token>',
});
```

Or you can attach them to `process.env` using
[dotenv](https://github.com/motdotla/dotenv), create `.env` file in your project
root, then put below code before you use aws4 sign

```js
require('dotenv').config();
```

The `sessionToken` property and `AWS_SESSION_TOKEN` environment constiable are
optional for signing with
[IAM STS temporary credentials](http://docs.aws.amazon.com/STS/latest/UsingSTS/using-temp-creds.html).

## LICENSE

[@yugasun](LICENSE)

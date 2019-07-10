import fs from 'fs';
import path from 'path';
import { RequestSigner, sign } from '../src';

const cred = { accessKeyId: 'ABCDEF', secretAccessKey: 'abcdef1234567890' };
const date = 'Wed, 26 Dec 2012 06:10:30 GMT';
const iso = '20121226T061030Z';
const auth = 'AWS4-HMAC-SHA256 Credential=ABCDEF/20121226/us-east-1/sqs/aws4_request, '
    + 'SignedHeaders=date;host;x-amz-date, '
    + 'Signature=d847efb54cd60f0a256174848f26e43af4b5168dbec3118dc9fd84e942285791';

describe('Aws4 Test', () => {
    // Save and ensure we restore process.env
    let envAccessKeyId;
    let envSecretAccessKey;

    beforeAll(() => {
        envAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
        envSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
        process.env.AWS_ACCESS_KEY_ID = cred.accessKeyId;
        process.env.AWS_SECRET_ACCESS_KEY = cred.secretAccessKey;
    });

    afterAll(() => {
        process.env.AWS_ACCESS_KEY_ID = envAccessKeyId;
        process.env.AWS_SECRET_ACCESS_KEY = envSecretAccessKey;
    });

    describe('#sign() when constructed with string url', () => {
        it('should parse into request correctly', () => {
            const signer = new RequestSigner('http://sqs.us-east-1.amazonaws.com/');
            signer.request.headers.Date = date;
            expect(signer.sign().headers.Authorization).toBe(auth);
        });

        it('should also support elastic search', () => {
            const signer = new RequestSigner('https://search-cluster-name-aaaaaa0aa00aa0aaaaaaa00aaa.eu-west-1.es.amazonaws.com');
            signer.request.headers.Date = date;
            expect(signer
                .sign()
                .headers.Authorization).toBe(
                'AWS4-HMAC-SHA256 Credential=ABCDEF/20121226/eu-west-1/es/aws4_request, SignedHeaders=date;host;x-amz-date, Signature=2dba21885bd7ccb0c5775c578c18a5c81fd30db84d4a2911933152df01de5260'
            );
        });
    });

    describe('RequestSigner', () => {
        it('should correctly recognise ses', () => {
            const signer = new RequestSigner('https://email.us-west-2.amazonaws.com');
            expect(signer.service).toBe('ses');
            expect(signer.region).toBe('us-west-2');
        });

        it('should correctly recognise es when interacting directly with the es api', () => {
            const signer = new RequestSigner('https://search-cluster-name-aaaaaa0aa00aa0aaaaaaa00aaa.eu-west-1.es.amazonaws.com');
            expect(signer.service).toBe('es');
            expect(signer.region).toBe('eu-west-1');
        });

        it("should correctly recognise es when interacting directly with aws's es configuration api", () => {
            const signer = new RequestSigner('https://es.us-west-2.amazonaws.com');
            expect(signer.service).toBe('es');
            expect(signer.region).toBe('us-west-2');
        });

        it('should correctly recognise sns', () => {
            const signer = new RequestSigner('https://sns.us-west-2.amazonaws.com');
            expect(signer.service).toBe('sns');
            expect(signer.region).toBe('us-west-2');
        });

        it('should know global endpoint is us-east-1 for sdb', () => {
            const signer = new RequestSigner('https://sdb.amazonaws.com');
            expect(signer.service).toBe('sdb');
            expect(signer.region).toBe('us-east-1');
        });

        it('should not set extra headers for CodeCommit Git access', () => {
            const signer = new RequestSigner({ service: 'codecommit', method: 'GIT', host: 'example.com' });
            signer.prepareRequest();
            expect(signer.request.headers).toEqual({ Host: 'example.com' });
        });

        it('should not have a "Z" at end of timestamp for CodeCommit Git access', () => {
            const signer = new RequestSigner({ service: 'codecommit', method: 'GIT', host: 'example.com' });
            expect(signer.getDateTime()).not.toMatch(/Z$/);
        });

        it('should not have a body hash in the canonical string for CodeCommit Git access', () => {
            const signer = new RequestSigner({ service: 'codecommit', method: 'GIT', host: 'example.com' });
            expect(signer.canonicalString()).toMatch(/\n$/);
        });
    });

    describe('#sign() with no credentials', () => {
        it('should use process.env values', () => {
            const opts = sign({ service: 'sqs', headers: { Date: date } });
            expect(opts.headers.Authorization).toBe(auth);
        });
    });

    describe('#sign() with credentials', () => {
        it('should use passed in values', () => {
            const cred = { accessKeyId: 'A', secretAccessKey: 'B' };
            const opts = sign({ service: 'sqs', headers: { Date: date } }, cred);
            expect(opts.headers.Authorization).toBe('AWS4-HMAC-SHA256 Credential=A/20121226/us-east-1/sqs/aws4_request, '
                + 'SignedHeaders=date;host;x-amz-date, '
                + 'Signature=5d8d587b6e3011935837d670e682646012977960d8a8d992503d852726af71b9');
        });
    });

    describe('#sign() with no host or region', () => {
        it('should add hostname and default region', () => {
            const opts = sign({ service: 'sqs' });
            expect(opts.hostname).toBe('sqs.us-east-1.amazonaws.com');
            expect(opts.headers.Host).toBe('sqs.us-east-1.amazonaws.com');
        });
        it('should add hostname and no region if service is regionless', () => {
            const opts = sign({ service: 'iam' });
            expect(opts.hostname).toBe('iam.amazonaws.com');
            expect(opts.headers.Host).toBe('iam.amazonaws.com');
        });
        it('should add hostname and no region if s3 and us-east-1', () => {
            const opts = sign({ service: 's3' });
            expect(opts.hostname).toBe('s3.amazonaws.com');
            expect(opts.headers.Host).toBe('s3.amazonaws.com');
        });
        it('should add hostname and no region if sdb and us-east-1', () => {
            const opts = sign({ service: 'sdb' });
            expect(opts.hostname).toBe('sdb.amazonaws.com');
            expect(opts.headers.Host).toBe('sdb.amazonaws.com');
        });
        it('should populate AWS headers correctly', () => {
            const opts = sign({ service: 'sqs', headers: { Date: date } });
            expect(opts.headers['X-Amz-Date']).toBe(iso);
            expect(opts.headers.Authorization).toBe(auth);
        });
    });

    describe('#sign() with no host, but with region', () => {
        it('should add correct hostname for regular services', () => {
            const opts = sign({ service: 'glacier', region: 'us-west-1' });
            expect(opts.hostname).toBe('glacier.us-west-1.amazonaws.com');
            expect(opts.headers.Host).toBe('glacier.us-west-1.amazonaws.com');
        });
        it('should add correct hostname for s3', () => {
            const opts = sign({ service: 's3', region: 'us-west-1' });
            expect(opts.hostname).toBe('s3-us-west-1.amazonaws.com');
            expect(opts.headers.Host).toBe('s3-us-west-1.amazonaws.com');
        });
        it('should add correct hostname for ses', () => {
            const opts = sign({ service: 'ses', region: 'us-west-1' });
            expect(opts.hostname).toBe('email.us-west-1.amazonaws.com');
            expect(opts.headers.Host).toBe('email.us-west-1.amazonaws.com');
        });
    });

    describe('#sign() with hostname', () => {
        it('should populate AWS headers correctly', () => {
            const opts = sign({ hostname: 'sqs.us-east-1.amazonaws.com', headers: { Date: date } });
            expect(opts.headers['X-Amz-Date']).toBe(iso);
            expect(opts.headers.Authorization).toBe(auth);
        });
        it('should use custom port correctly', () => {
            const opts = sign({
                hostname: 'localhost',
                port: '9000',
                service: 's3',
                headers: { Date: date },
            });
            expect(opts.headers['X-Amz-Date']).toBe(iso);
            expect(opts.headers.Authorization).toBe('AWS4-HMAC-SHA256 Credential=ABCDEF/20121226/us-east-1/s3/aws4_request, '
                + 'SignedHeaders=date;host;x-amz-content-sha256;x-amz-date, '
                + 'Signature=6fda8a58c01edfcb6773c15ad5a276a893ce52978a8f5cd1705fae14df78cfd4');
        });
    });

    describe('#sign() with host', () => {
        it('should populate AWS headers correctly', () => {
            const opts = sign({ host: 'sqs.us-east-1.amazonaws.com', headers: { Date: date } });
            expect(opts.headers['X-Amz-Date']).toBe(iso);
            expect(opts.headers.Authorization).toBe(auth);
        });
        it('should use custom port correctly', () => {
            const opts = sign({
                host: 'localhost',
                port: '9000',
                service: 's3',
                headers: { Date: date },
            });
            expect(opts.headers['X-Amz-Date']).toBe(iso);
            expect(opts.headers.Authorization).toBe('AWS4-HMAC-SHA256 Credential=ABCDEF/20121226/us-east-1/s3/aws4_request, '
                + 'SignedHeaders=date;host;x-amz-content-sha256;x-amz-date, '
                + 'Signature=6fda8a58c01edfcb6773c15ad5a276a893ce52978a8f5cd1705fae14df78cfd4');
        });
    });

    describe('#sign() with body', () => {
        it('should use POST', () => {
            const opts = sign({ body: 'SomeAction' });
            expect(opts.method).toBe('POST');
        });
        it('should set Content-Type', () => {
            const opts = sign({ body: 'SomeAction' });
            expect(opts.headers['Content-Type']).toBe('application/x-www-form-urlencoded; charset=utf-8');
        });
    });

    describe('#sign() with many different options', () => {
        it('should populate AWS headers correctly', () => {
            const opts = sign({
                service: 'dynamodb',
                region: 'ap-southeast-2',
                method: 'DELETE',
                path: '/Some/Path?param=key&param=otherKey',
                body: 'SomeAction=SomeThing&Whatever=SomeThingElse',
                headers: {
                    Date: date,
                    'Content-Type': 'application/x-amz-json-1.0',
                    'X-Amz-Target': 'DynamoDB_20111205.ListTables',
                },
            });
            expect(opts.headers['X-Amz-Date']).toBe(iso);
            expect(opts.headers.Authorization).toBe(
                'AWS4-HMAC-SHA256 Credential=ABCDEF/20121226/ap-southeast-2/dynamodb/aws4_request, '
                    + 'SignedHeaders=content-length;content-type;date;host;x-amz-date;x-amz-target, '
                    + 'Signature=f9a00417d284dfe2cfdef809652c1d54add4e159835a0c69ac8cbdaa227a5000'
            );
        });
    });

    describe('#sign() with signQuery', () => {
        it('should work with standard services', () => {
            const opts = sign({
                service: 'dynamodb',
                path: `/?X-Amz-Date=${iso}`,
                headers: {
                    'Content-Type': 'application/x-amz-json-1.0',
                    'X-Amz-Target': 'DynamoDB_20120810.ListTables',
                },
                body: '{}',
                signQuery: true,
            });
            expect(opts.path).toBe('/?X-Amz-Date=20121226T061030Z&X-Amz-Algorithm=AWS4-HMAC-SHA256&'
                + 'X-Amz-Credential=ABCDEF%2F20121226%2Fus-east-1%2Fdynamodb%2Faws4_request&'
                + 'X-Amz-SignedHeaders=content-type%3Bhost%3Bx-amz-target&'
                + 'X-Amz-Signature=3529a3f866ef85935692c2f2f6e8edb67de2ec91ce79ba5f1dbe28fc66cb154e');
        });
        it('should work with s3', () => {
            const opts = sign({
                service: 's3',
                path: `/some-bucket?X-Amz-Date=${iso}`,
                signQuery: true,
            });
            expect(opts.path).toBe(
                '/some-bucket?X-Amz-Date=20121226T061030Z&X-Amz-Expires=86400&X-Amz-Algorithm=AWS4-HMAC-SHA256&'
                    + 'X-Amz-Credential=ABCDEF%2F20121226%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-SignedHeaders=host&'
                    + 'X-Amz-Signature=1acb058aaf5ce6ea6125f03231ab2b64acc9ce05fd70e4c7f087515adc41814a'
            );
        });
        it('should adhere to RFC-3986', () => {
            const opts = sign({
                service: 's3',
                path: `/some-bucket?a=!'&b=()*&X-Amz-Date=${iso}`,
                signQuery: true,
            });
            expect(opts.path).toBe(
                '/some-bucket?a=%21%27&b=%28%29%2A&X-Amz-Date=20121226T061030Z&X-Amz-Expires=86400&X-Amz-Algorithm=AWS4-HMAC-SHA256&'
                    + 'X-Amz-Credential=ABCDEF%2F20121226%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-SignedHeaders=host&'
                    + 'X-Amz-Signature=5f3e8e3406e27471183900f8ee891a6ae40e959c05394b4271a2b5b543d5a14a'
            );
        });

        it('should work with none service host', () => {
            const opts = sign({
                path: `/?X-Amz-Date=${iso}`,
                headers: {
                    host: '.us-east-1.amazonaws.com',
                    'content-type': 'application/json',
                },
                body: '{}',
                signQuery: true,
            });
            expect(opts.path).toBe('/?X-Amz-Date=20121226T061030Z&X-Amz-Algorithm=AWS4-HMAC-SHA256&'
                + 'X-Amz-Credential=ABCDEF%2F20121226%2Fus-east-1%2F%2Faws4_request&'
                + 'X-Amz-SignedHeaders=content-type%3Bhost&'
                + 'X-Amz-Signature=96563a98f043840f22f2859f925eb1f038504848a7b7c7512c42fd0508bee5c8');
        });
    });

    describe('#sign() with X-Amz-Content-Sha256 header', () => {
        it('should preserve given header', () => {
            const opts = sign({
                service: 's3',
                method: 'PUT',
                path: '/some-bucket/file.txt',
                body: 'Test Body',
                headers: {
                    'X-Amz-Content-Sha256': 'My-Generated-Body-Hash',
                },
            });
            expect(opts.headers['X-Amz-Content-Sha256']).toBe('My-Generated-Body-Hash');
        });

        it('should use given header in signature calculation', () => {
            const opts = sign({
                service: 's3',
                method: 'PUT',
                path: '/some-bucket/file.txt',
                body: 'Test Body',
                headers: {
                    Date: date,
                    'X-Amz-Content-Sha256': 'My-Generated-Body-Hash',
                },
            });
            expect(opts.headers.Authorization).toBe('AWS4-HMAC-SHA256 Credential=ABCDEF/20121226/us-east-1/s3/aws4_request, '
                + 'SignedHeaders=content-length;content-type;date;host;x-amz-content-sha256;x-amz-date, '
                + 'Signature=afa4074a64185317be81ed18953c6df9ee3a63507e6711ad79a7534f4c0b0c54');
        });

        it('should use given lowercase header in signature calculation', () => {
            const opts = sign({
                service: 's3',
                method: 'PUT',
                path: '/some-bucket/file.txt',
                body: 'Test Body',
                headers: {
                    Date: date,
                    'x-amz-content-sha256': 'My-Generated-Body-Hash',
                },
            });
            expect(opts.headers.Authorization).toBe('AWS4-HMAC-SHA256 Credential=ABCDEF/20121226/us-east-1/s3/aws4_request, '
                + 'SignedHeaders=content-length;content-type;date;host;x-amz-content-sha256;x-amz-date, '
                + 'Signature=afa4074a64185317be81ed18953c6df9ee3a63507e6711ad79a7534f4c0b0c54');
        });
    });

    describe('#signature() with CodeCommit Git access', () => {
        it('should generate signature correctly', () => {
            const signer = new RequestSigner({
                service: 'codecommit',
                host: 'git-codecommit.us-east-1.amazonaws.com',
                method: 'GIT',
                path: '/v1/repos/MyAwesomeRepo',
            });
            signer.request.headers.Date = date;
            expect(signer.getDateTime()).toBe('20121226T061030');
            delete signer.request.headers.Date;
            expect(signer.signature()).toBe('2a9a182eb6afc3859ee590af942564b53b0c4e5beac2893052515401d06af92a');
        });
    });

    describe('#canonicalString()', () => {
        it('should work with chars > 127 and < 255 with s3', () => {
            const signer = new RequestSigner({ service: 's3', path: '/ü' });
            const canonical = signer.canonicalString().split('\n');

            expect(canonical[1]).toBe('/%C3%BC');
            expect(canonical[2]).toBe('');
            expect(signer.sign().path).toBe('/%C3%BC');
        });

        it('should work with chars > 127 and < 255 with non-s3', () => {
            const signer = new RequestSigner({ service: 'es', path: '/ü' });
            const canonical = signer.canonicalString().split('\n');

            expect(canonical[1]).toBe('/%25C3%25BC');
            expect(canonical[2]).toBe('');
            expect(signer.sign().path).toBe('/%C3%BC');
        });

        it('should work with chars > 255 with s3', () => {
            const signer = new RequestSigner({ service: 's3', path: '/€' });
            const canonical = signer.canonicalString().split('\n');

            expect(canonical[1]).toBe('/%E2%82%AC');
            expect(canonical[2]).toBe('');
            expect(signer.sign().path).toBe('/%E2%82%AC');
        });

        it('should work with chars > 255 with non-s3', () => {
            const signer = new RequestSigner({ service: 'es', path: '/€' });
            const canonical = signer.canonicalString().split('\n');

            expect(canonical[1]).toBe('/%25E2%2582%25AC');
            expect(canonical[2]).toBe('');
            expect(signer.sign().path).toBe('/%E2%82%AC');
        });

        it('should work with chars > 255 with s3 and signQuery', () => {
            const signer = new RequestSigner({ service: 's3', path: '/€', signQuery: true });
            const canonical = signer.canonicalString().split('\n');

            expect(canonical[1]).toBe('/%E2%82%AC');
            expect(canonical[2]).toMatch(new RegExp(
                '^X-Amz-Algorithm=AWS4-HMAC-SHA256&'
                    + 'X-Amz-Credential=ABCDEF%2F\\d{8}%2Fus-east-1%2Fs3%2Faws4_request&'
                    + 'X-Amz-Date=\\d{8}T\\d{6}Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host$',
            ));
        });

        it('should work with chars > 255 with non-s3 and signQuery', () => {
            const signer = new RequestSigner({ service: 'es', path: '/€', signQuery: true });
            const canonical = signer.canonicalString().split('\n');

            expect(canonical[1]).toBe('/%25E2%2582%25AC');
            expect(canonical[2]).toMatch(new RegExp(
                '^X-Amz-Algorithm=AWS4-HMAC-SHA256&'
                    + 'X-Amz-Credential=ABCDEF%2F\\d{8}%2Fus-east-1%2Fes%2Faws4_request&'
                    + 'X-Amz-Date=\\d{8}T\\d{6}Z&X-Amz-SignedHeaders=host$',
            ));
        });

        it('should work with reserved chars with s3', () => {
            const signer = new RequestSigner({ service: 's3', path: '/%41' });
            const canonical = signer.canonicalString().split('\n');

            expect(canonical[1]).toBe('/A');
            expect(canonical[2]).toBe('');
            expect(signer.sign().path).toBe('/%41');
        });

        it('should work with reserved chars with non-s3', () => {
            const signer = new RequestSigner({ service: 'es', path: '/%41' });
            const canonical = signer.canonicalString().split('\n');

            expect(canonical[1]).toBe('/%2541');
            expect(canonical[2]).toBe('');
            expect(signer.sign().path).toBe('/%41');
        });

        it('should work with RFC-3986 chars with s3', () => {
            const signer = new RequestSigner({ service: 's3', path: "/!'()*%21%27%28%29%2A" });
            const canonical = signer.canonicalString().split('\n');

            expect(canonical[1]).toBe('/%21%27%28%29%2A%21%27%28%29%2A');
            expect(canonical[2]).toBe('');
            expect(signer.sign().path).toBe("/!'()*%21%27%28%29%2A");
        });

        it('should work with RFC-3986 chars with non-s3', () => {
            const signer = new RequestSigner({ service: 'es', path: "/!'()*%21%27%28%29%2A" });
            const canonical = signer.canonicalString().split('\n');

            expect(canonical[1]).toBe('/%21%27%28%29%2A%2521%2527%2528%2529%252A');
            expect(canonical[2]).toBe('');
            expect(signer.sign().path).toBe("/!'()*%21%27%28%29%2A");
        });

        it('should normalize casing on percent encoding with s3', () => {
            const signer = new RequestSigner({ service: 's3', path: '/%2a' });
            const canonical = signer.canonicalString().split('\n');

            expect(canonical[1]).toBe('/%2A');
            expect(canonical[2]).toBe('');
            expect(signer.sign().path).toBe('/%2a');
        });

        it('should just escape percent encoding on non-s3', () => {
            const signer = new RequestSigner({ service: 'es', path: '/%2a' });
            const canonical = signer.canonicalString().split('\n');

            expect(canonical[1]).toBe('/%252a');
            expect(canonical[2]).toBe('');
            expect(signer.sign().path).toBe('/%2a');
        });

        it('should decode %2F with s3', () => {
            const signer = new RequestSigner({ service: 's3', path: '/%2f%2f' });
            const canonical = signer.canonicalString().split('\n');

            expect(canonical[1]).toBe('///');
            expect(canonical[2]).toBe('');
            expect(signer.sign().path).toBe('/%2f%2f');
        });

        it('should just escape %2F on non-s3', () => {
            const signer = new RequestSigner({ service: 'es', path: '/%2f%2f' });
            const canonical = signer.canonicalString().split('\n');

            expect(canonical[1]).toBe('/%252f%252f');
            expect(canonical[2]).toBe('');
            expect(signer.sign().path).toBe('/%2f%2f');
        });

        it('should work with mixed chars > 127 and < 255 and percent encoding with s3', () => {
            const signer = new RequestSigner({ service: 's3', path: '/ü%41' });
            const canonical = signer.canonicalString().split('\n');

            expect(canonical[1]).toBe('/%C3%BCA');
            expect(canonical[2]).toBe('');
            expect(signer.sign().path).toBe('/%C3%BCA');
        });

        it('should work with mixed chars > 127 and < 255 percent encoding with non-s3', () => {
            const signer = new RequestSigner({ service: 'es', path: '/ü%41' });
            const canonical = signer.canonicalString().split('\n');

            expect(canonical[1]).toBe('/%25C3%25BCA');
            expect(canonical[2]).toBe('');
            expect(signer.sign().path).toBe('/%C3%BCA');
        });

        it('should work with mixed chars > 127 and < 255 and percent encoding and query params with s3', () => {
            const signer = new RequestSigner({ service: 's3', path: '/ü%41?a=%41ü' });
            const canonical = signer.canonicalString().split('\n');

            expect(canonical[1]).toBe('/%C3%BCA');
            expect(canonical[2]).toBe('a=A%C3%BC');
            expect(signer.sign().path).toBe('/%C3%BCA?a=A%C3%BC');
        });

        it('should work with mixed chars > 127 and < 255 percent encoding and query params with non-s3', () => {
            const signer = new RequestSigner({ service: 'es', path: '/ü%41?a=%41ü' });
            const canonical = signer.canonicalString().split('\n');

            expect(canonical[1]).toBe('/%25C3%25BCA');
            expect(canonical[2]).toBe('a=A%C3%BC');
            expect(signer.sign().path).toBe('/%C3%BCA?a=A%C3%BC');
        });

        it('should work with mixed chars > 255 and percent encoding and query params with s3', () => {
            const signer = new RequestSigner({ service: 's3', path: '/€ü%41?€ü=%41€ü' });
            const canonical = signer.canonicalString().split('\n');

            expect(canonical[1]).toBe('/%E2%82%AC%C3%BCA');
            expect(canonical[2]).toBe('%E2%82%AC%C3%BC=A%E2%82%AC%C3%BC');
            expect(signer.sign().path).toBe('/%E2%82%AC%C3%BCA?%E2%82%AC%C3%BC=A%E2%82%AC%C3%BC');
        });

        it('should work with mixed chars > 255 percent encoding and query params with non-s3', () => {
            const signer = new RequestSigner({ service: 'es', path: '/€ü%41?€ü=%41€ü' });
            const canonical = signer.canonicalString().split('\n');

            expect(canonical[1]).toBe('/%25E2%2582%25AC%25C3%25BCA');
            expect(canonical[2]).toBe('%E2%82%AC%C3%BC=A%E2%82%AC%C3%BC');
            expect(signer.sign().path).toBe('/%E2%82%AC%C3%BCA?%E2%82%AC%C3%BC=A%E2%82%AC%C3%BC');
        });

        it('should work with %2F in query params with s3', () => {
            const signer = new RequestSigner({ service: 's3', path: '/%2f?a=/&/=%2f' });
            const canonical = signer.canonicalString().split('\n');

            expect(canonical[1]).toBe('//');
            expect(canonical[2]).toBe('%2F=%2F&a=%2F');
            expect(signer.sign().path).toBe('/%2f?a=%2F&%2F=%2F');
        });

        it('should work with %2F in query params with non-s3', () => {
            const signer = new RequestSigner({ service: 'es', path: '/%2f?a=/&/=%2f' });
            const canonical = signer.canonicalString().split('\n');

            expect(canonical[1]).toBe('/%252f');
            expect(canonical[2]).toBe('%2F=%2F&a=%2F');
            expect(signer.sign().path).toBe('/%2f?a=%2F&%2F=%2F');
        });

        it('should work with query param order in s3', () => {
            const signer = new RequestSigner({ service: 's3', path: '/?a=b&a=B&a=b&a=c' });
            const canonical = signer.canonicalString().split('\n');

            expect(canonical[1]).toBe('/');
            expect(canonical[2]).toBe('a=b');
            expect(signer.sign().path).toBe('/?a=b&a=B&a=b&a=c');
        });

        it('should work with query param order in non-s3', () => {
            const signer = new RequestSigner({ service: 'es', path: '/?a=b&a=B&a=b&a=c' });
            const canonical = signer.canonicalString().split('\n');

            expect(canonical[1]).toBe('/');
            expect(canonical[2]).toBe('a=B&a=b&a=b&a=c');
            expect(signer.sign().path).toBe('/?a=b&a=B&a=b&a=c');
        });

        it('should not normalize path in s3', () => {
            const signer = new RequestSigner({ service: 's3', path: '//a/b/..//c/.?a=b' });
            const canonical = signer.canonicalString().split('\n');

            expect(canonical[1]).toBe('//a/b/..//c/.');
            expect(canonical[2]).toBe('a=b');
            expect(signer.sign().path).toBe('//a/b/..//c/.?a=b');
        });

        it('should normalize path in non-s3', () => {
            const signer = new RequestSigner({ service: 'es', path: '//a/b/..//c/.?a=b' });
            const canonical = signer.canonicalString().split('\n');

            expect(canonical[1]).toBe('/a/c');
            expect(canonical[2]).toBe('a=b');
            expect(signer.sign().path).toBe('//a/b/..//c/.?a=b');
        });

        it('should normalize path in non-s3 with slash on the end', () => {
            const signer = new RequestSigner({ service: 'es', path: '//a/b/..//c/./?a=b' });
            const canonical = signer.canonicalString().split('\n');

            expect(canonical[1]).toBe('/a/c/');
            expect(canonical[2]).toBe('a=b');
            expect(signer.sign().path).toBe('//a/b/..//c/./?a=b');
        });

        it('should deal with complex query params in s3', () => {
            const signer = new RequestSigner({ service: 's3', path: '/?&a=&&=&%41&' });
            const canonical = signer.canonicalString().split('\n');

            expect(canonical[1]).toBe('/');
            expect(canonical[2]).toBe('A=&a=');
            expect(signer.sign().path).toBe('/?a=&A=');
        });

        it('should deal with complex query params in non-s3', () => {
            const signer = new RequestSigner({ service: 'es', path: '/?&a=&&=&%41&' });
            const canonical = signer.canonicalString().split('\n');

            expect(canonical[1]).toBe('/');
            expect(canonical[2]).toBe('A=&a=');
            expect(signer.sign().path).toBe('/?a=&A=');
        });
    });

    describe('with AWS test suite', () => {
        const CREDENTIALS = {
            accessKeyId: 'AKIDEXAMPLE',
            secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
        };
        const SERVICE = 'service';

        const suiteDir = path.join(__dirname, './aws-sig-v4-test-suite');
        const ignoreDirs = ['get-header-value-multiline', 'normalize-path', 'post-sts-token']; // too annoying to parse multiline
        const tests = fs
            .readdirSync(suiteDir)
            .concat(fs.readdirSync(path.join(suiteDir, './normalize-path')).map(d => path.join('normalize-path', d)))
            .filter(t => !~t.indexOf('.') && !~ignoreDirs.indexOf(t));

        tests.forEach((test) => {
            it(`should pass ${test}`, () => {
                const files = fs.readdirSync(path.join(suiteDir, test));
                const readFile = function (regex) {
                    const file = path.join(suiteDir, test, files.filter(regex.test.bind(regex))[0]);
                    return fs.readFileSync(file, 'utf8').replace(/\r/g, '');
                };
                const request = readFile(/\.req$/);
                const canonicalString = readFile(/\.creq$/);
                const stringToSign = readFile(/\.sts$/);
                const outputAuth = readFile(/\.authz$/);

                const reqLines = request.split('\n');
                const req = reqLines[0].split(' ');
                const method = req[0];
                const pathname = req.slice(1, -1).join(' ');
                const headers = {};
                let i;
                for (i = 1; i < reqLines.length; i++) {
                    if (!reqLines[i]) break;
                    const colonIx = reqLines[i].indexOf(':');
                    const header = reqLines[i].slice(0, colonIx).toLowerCase();
                    const value = reqLines[i].slice(colonIx + 1);
                    if (headers[header]) {
                        headers[header] = headers[header].split(',');
                        headers[header].push(value);
                        headers[header] = headers[header].join(',');
                    } else {
                        headers[header] = value;
                    }
                }
                const body = reqLines.slice(i + 1).join('\n');

                const signer = new RequestSigner(
                    {
                        service: SERVICE,
                        method,
                        path: pathname,
                        headers,
                        body,
                        doNotModifyHeaders: true,
                        doNotEncodePath: true,
                    },
                    CREDENTIALS,
                );

                if (signer.datetime == null && headers['x-amz-date']) {
                    signer.datetime = headers['x-amz-date'];
                }

                expect(signer.canonicalString()).toBe(canonicalString);
                expect(signer.stringToSign()).toBe(stringToSign);
                expect(signer.sign().headers.Authorization).toBe(outputAuth);
            });
        });
    });
});

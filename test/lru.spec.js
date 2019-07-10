import Lru from '../src/lru';

describe('Aws4 Lru Test', () => {
    it('should return nothing if does not exist yet', () => {
        const cache = new Lru(5);
        expect(cache.get('a')).toBeFalsy();
    });

    it('should return value from single set', () => {
        const cache = new Lru(5);
        cache.set('a', 'A');
        expect(cache.get('a')).toBe('A');
    });

    it('should return value if just at capacity', () => {
        const cache = new Lru(5);
        cache.set('a', 'A');
        cache.set('b', 'B');
        cache.set('c', 'C');
        cache.set('d', 'D');
        cache.set('e', 'E');
        expect(cache.get('e')).toBe('E');
        expect(cache.get('d')).toBe('D');
        expect(cache.get('c')).toBe('C');
        expect(cache.get('b')).toBe('B');
        expect(cache.get('a')).toBe('A');
    });

    it('should not return value just over capacity', () => {
        const cache = new Lru(5);
        cache.set('a', 'A');
        cache.set('b', 'B');
        cache.set('c', 'C');
        cache.set('d', 'D');
        cache.set('e', 'E');
        cache.set('f', 'F');
        expect(cache.get('f')).toBe('F');
        expect(cache.get('e')).toBe('E');
        expect(cache.get('d')).toBe('D');
        expect(cache.get('c')).toBe('C');
        expect(cache.get('b')).toBe('B');
        expect(cache.get('a')).toBeFalsy();
    });

    it('should return value if get recently', () => {
        const cache = new Lru(5);
        cache.set('a', 'A');
        cache.set('b', 'B');
        cache.set('c', 'C');
        cache.set('d', 'D');
        cache.set('e', 'E');
        expect(cache.get('a')).toBe('A');
        cache.set('f', 'F');
        expect(cache.get('f')).toBe('F');
        expect(cache.get('e')).toBe('E');
        expect(cache.get('d')).toBe('D');
        expect(cache.get('c')).toBe('C');
        expect(cache.get('a')).toBe('A');
        expect(cache.get('b')).toBeFalsy();
    });

    it('should return value if set recently', () => {
        const cache = new Lru(5);
        cache.set('a', 'A');
        cache.set('b', 'B');
        cache.set('c', 'C');
        cache.set('d', 'D');
        cache.set('e', 'E');
        cache.set('a', 'AA');
        cache.set('f', 'F');
        expect(cache.get('f')).toBe('F');
        expect(cache.get('e')).toBe('E');
        expect(cache.get('d')).toBe('D');
        expect(cache.get('c')).toBe('C');
        expect(cache.get('a')).toBe('AA');
        expect(cache.get('b')).toBeFalsy();
    });
});

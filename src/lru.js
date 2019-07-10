/* eslint-disable no-bitwise */
class DoublyLinkedList {
    constructor() {
        this.firstNode = null;
        this.lastNode = null;
    }

    moveToFront(node) {
        if (this.firstNode === node) return;

        this.remove(node);

        if (this.firstNode === null) {
            this.firstNode = node;
            this.lastNode = node;
            node.prev = null;
            node.next = null;
        } else {
            node.prev = null;
            node.next = this.firstNode;
            node.next.prev = node;
            this.firstNode = node;
        }
    }

    pop() {
        const { lastNode } = this;
        if (lastNode) {
            this.remove(lastNode);
        }
        return lastNode;
    }

    remove(node) {
        if (this.firstNode === node) {
            this.firstNode = node.next;
        } else if (node.prev !== null) {
            node.prev.next = node.next;
        }
        if (this.lastNode === node) {
            this.lastNode = node.prev;
        } else if (node.next !== null) {
            node.next.prev = node.prev;
        }
    }
}

class DoublyLinkedNode {
    constructor(key, val) {
        this.key = key;
        this.val = val;
        this.prev = null;
        this.next = null;
    }
}

class LruCache {
    constructor(size) {
        this.capacity = size | 0;
        this.map = Object.create(null);
        this.list = new DoublyLinkedList();
    }

    get(key) {
        const node = this.map[key];
        if (!node) return undefined;
        this.used(node);
        return node.val;
    }

    set(key, val) {
        let node = this.map[key];
        if (node) {
            node.val = val;
        } else {
            if (!this.capacity) this.prune();
            if (!this.capacity) return false;
            node = new DoublyLinkedNode(key, val);
            this.map[key] = node;
            this.capacity -= 1;
        }
        this.used(node);
        return true;
    }

    used(node) {
        this.list.moveToFront(node);
    }

    prune() {
        const node = this.list.pop();
        if (node) {
            delete this.map[node.key];
            this.capacity += 1;
        }
    }
}

export default LruCache;

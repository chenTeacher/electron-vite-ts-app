// CircularQueue.ts
export default class CircularQueue<T> {
    private queue: T[]
    private size: number
    private front: number
    private rear: number
  
    constructor(size: number) {
      this.size = size
      this.queue = new Array(size)
      this.front = this.rear = -1
    }
  
    enqueue(item: T) {
      if ((this.rear + 1) % this.size === this.front) {
        // Queue is full, overwrite oldest element
        this.dequeue()
      }
      this.rear = (this.rear + 1) % this.size
      this.queue[this.rear] = item
      if (this.front === -1) {
        this.front = this.rear
      }
    }
  
    dequeue(): T | undefined {
      if (this.front === -1) {
        // Queue is empty
        return undefined
      }
      const item = this.queue[this.front]
      if (this.front === this.rear) {
        this.front = this.rear = -1
      } else {
        this.front = (this.front + 1) % this.size
      }
      return item
    }
  
    print() {
      let current = this.front
      while (current !== -1) {
        console.log(this.queue[current])
        if (current === this.rear) {
          break
        }
        current = (current + 1) % this.size
      }
    }
  }
  
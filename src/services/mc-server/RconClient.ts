import net from 'net';

interface RconOptions {
  host: string;
  port: number;
  password: string;
}

class RconClient {
  private socket: net.Socket | null = null;
  private requestId = 0;
  private connected = false;
  private authenticated = false;
  private responseBuffer: Buffer = Buffer.alloc(0);

  async connect(options: RconOptions): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();
      
      const timeout = setTimeout(() => {
        this.socket?.destroy();
        reject(new Error('Connection timeout'));
      }, 5000);

      this.socket.connect(options.port, options.host, () => {
        clearTimeout(timeout);
        this.connected = true;
        this.authenticate(options.password)
          .then(resolve)
          .catch(reject);
      });

      this.socket.on('error', (err) => {
        clearTimeout(timeout);
        this.connected = false;
        reject(err);
      });

      this.socket.on('close', () => {
        this.connected = false;
        this.authenticated = false;
      });

      this.socket.on('data', (data) => {
        this.responseBuffer = Buffer.concat([this.responseBuffer, data]);
      });
    });
  }

  private async authenticate(password: string): Promise<boolean> {
    const packet = this.createPacket(3, password);
    this.socket?.write(packet);
    
    await this.waitForResponse();
    this.authenticated = true;
    return true;
  }

  async sendCommand(command: string): Promise<string> {
    if (!this.connected || !this.authenticated) {
      throw new Error('Not connected or authenticated');
    }

    this.requestId++;
    const packet = this.createPacket(2, command);
    this.socket?.write(packet);

    return this.waitForResponse();
  }

  private createPacket(type: number, payload: string): Buffer {
    const length = 4 + 4 + Buffer.byteLength(payload) + 2;
    const buffer = Buffer.alloc(length);
    
    let offset = 0;
    buffer.writeInt32LE(length - 4, offset); offset += 4;
    buffer.writeInt32LE(this.requestId, offset); offset += 4;
    buffer.writeInt32LE(type, offset); offset += 4;
    buffer.write(payload, offset); offset += Buffer.byteLength(payload);
    buffer.writeInt16LE(0, offset);
    
    return buffer;
  }

  private async waitForResponse(): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Response timeout'));
      }, 5000);

      const checkBuffer = () => {
        if (this.responseBuffer.length >= 4) {
          const length = this.responseBuffer.readInt32LE(0);
          if (this.responseBuffer.length >= length + 4) {
            clearTimeout(timeout);
            const response = this.responseBuffer.subarray(12, length + 2);
            this.responseBuffer = this.responseBuffer.subarray(length + 4);
            resolve(response.toString().replace(/\x00/g, ''));
          }
        }
      };

      const interval = setInterval(() => {
        checkBuffer();
        clearInterval(interval);
      }, 50);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.connected = false;
    this.authenticated = false;
  }
}

export { RconClient };

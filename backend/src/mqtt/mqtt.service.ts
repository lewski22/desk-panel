import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config'; import * as mqtt from 'mqtt';
@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client: mqtt.MqttClient|null = null;
  private checkinHandler?: (d: string, p: any) => void;
  private statusHandler?:  (d: string, p: any) => void;
  private gwHelloHandler?: (g: string, p: any) => void;
  constructor(private config: ConfigService) {}
  onModuleInit() {
    const url=this.config.get<string>('MQTT_BROKER_URL','mqtt://localhost:1883');
    const user=this.config.get<string>('MQTT_USERNAME','backend');
    const pass=this.config.get<string>('MQTT_PASSWORD','');
    this.client=mqtt.connect(url,{username:user,password:pass,reconnectPeriod:5000,clientId:`backend-${Date.now()}`});
    this.client.on('connect',()=>{ this.logger.log(`MQTT: ${url}`); this.client?.subscribe(['desk/+/checkin','desk/+/status','gateway/+/hello','gateway/+/heartbeat']); });
    this.client.on('message',(topic,msg)=>{ try { const p=JSON.parse(msg.toString()); const t=topic.split('/');
      if(t[0]==='desk'&&t[2]==='checkin'&&this.checkinHandler) this.checkinHandler(t[1],p);
      else if(t[0]==='desk'&&t[2]==='status'&&this.statusHandler) this.statusHandler(t[1],p);
      else if(t[0]==='gateway'&&this.gwHelloHandler) this.gwHelloHandler(t[1],p); } catch{} });
    this.client.on('error',(e)=>this.logger.error('MQTT',e.message));
  }
  onModuleDestroy() { this.client?.end(); }
  publish(topic: string, payload: object, opts?: any) { this.client?.publish(topic,JSON.stringify(payload),{qos:1,...opts}); }
  registerCheckinHandler(fn:(d:string,p:any)=>void){this.checkinHandler=fn;}
  registerStatusHandler(fn:(d:string,p:any)=>void){this.statusHandler=fn;}
  registerGatewayHelloHandler(fn:(g:string,p:any)=>void){this.gwHelloHandler=fn;}
}

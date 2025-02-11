import  ProtocolBasic  from './common/ProtocolBasic';

export default class PowerProtocol extends ProtocolBasic{
    public getProtocolType(): string {
        return 'power'
    }
}
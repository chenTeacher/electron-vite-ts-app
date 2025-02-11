import  ProtocolBasic  from './common/ProtocolBasic';

export default class ChargerProtocol extends ProtocolBasic{
    public getProtocolType(): string {
        return 'charger'
    }
}
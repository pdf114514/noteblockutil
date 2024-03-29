import { ComplexInventoryTransaction, InventorySource, ItemStack } from "bdsx/bds/inventory";
import { NetworkIdentifier } from "bdsx/bds/networkidentifier";
import { CANCEL } from "bdsx/common";
import { events } from "bdsx/event";
import { bedrockServer } from "bdsx/launcher";
import { Event } from "bdsx/eventtarget";
import { MinecraftPacketIds } from "bdsx/bds/packetids";
let system!:IVanillaServerSystem;
events.serverOpen.on(()=>{
    system = server.registerSystem(0,0);
});
if (bedrockServer.isLaunched()) system = server.registerSystem(0,0);

let timeout = new Map<NetworkIdentifier, NodeJS.Timeout>();

events.packetBefore(MinecraftPacketIds.InventoryTransaction).on((pkt, target)=>{
    if (pkt.transaction.type === ComplexInventoryTransaction.Type.ItemUseTransaction) {
        let actor = target.getActor();
        if (actor === null) return;
        let entity = actor.getEntity();
        let itemStack = actor.getMainhandSlot();
        let hand = system.getComponent(entity, "minecraft:hand_container");
        if (hand === null) return;
        let mainhand = (hand.data[0] as IItemStack).__identifier__;
        if (timeout.has(target)) {
            clearTimeout(timeout.get(target)!);
            timeout.set(target, setTimeout(()=>{
                timeout.delete(target);
            }, 300));
        }
        else {
            timeout.set(target, setTimeout(()=>{
                timeout.delete(target);
            }, 300));
            return onUseItem.fire(target, mainhand, itemStack);
        }
    }
});

export const onUseItem = new Event<(target:NetworkIdentifier, itemName:string, itemStack:ItemStack) => void | CANCEL>();
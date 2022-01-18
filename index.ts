//export function NoteBlockUtil(system: IVanillaServerSystem)
import { events } from "bdsx/event";
import { ContainerId, ItemStack } from "bdsx/bds/inventory";
import { serverInstance } from "bdsx/bds/server";
import { system } from "../example_and_test/bedrockapi-system";
import { command } from "bdsx/command";
import { BlockPos } from "bdsx/bds/blockpos";
import { CommandPermissionLevel, ActorWildcardCommandSelector, CommandRawText, CommandOutputParameter, CommandOutputType, CommandVisibilityFlag } from "bdsx/bds/command";
import { int32_t, bool_t } from "bdsx/nativetype";
import { ByteTag, CompoundTag, IntTag, ListTag, ShortTag, StringTag, Tag } from "bdsx/bds/nbt";
import { CANCEL } from "bdsx/common";
import { CustomForm, FormDropdown, FormInput, FormSlider } from "bdsx/bds/form";
import { onUseItem } from "./onUse";
import { Block, BlockSource } from "bdsx/bds/block";
import { DimensionId } from "bdsx/bds/actor";
import { PlaySoundPacket } from "bdsx/bds/packets";

function sleep(ms: number): Promise<NodeJS.Timeout> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function log(...items: any[]) {
    // Convert every parameter into a legible string and collect them into an array.
    function toString(item: any) : string {
        switch (Object.prototype.toString.call(item)) {
            case '[object Undefined]':
                return 'undefined'
            case '[object Null]':
                return 'null'
            case '[object String]':
                return `"${item}"`
            case '[object Array]':
                const array = item.map(toString)
                return `[${array.join(', ')}]`
            case '[object Object]':
                const object = Object.keys(item).map(
                    (key) => `${key}: ${toString(item[key])}`
                )
                return `{${object.join(', ')}}`
            case '[object Function]':
                return item.toString()
            default:
                return item
        }
    }

    // Join the string array items into a single string and print it to the world's chat.
    const chatEvent: any = system.createEventData("minecraft:display_chat_event");
    chatEvent.data.message = items.map(toString).join(' ');
    system.broadcastEvent('minecraft:display_chat_event', chatEvent);
}

function executeCommandAsync(command: string): Promise<IExecuteCommandCallback> {
    return new Promise(resolve => system.executeCommand(command, resolve));
}

function createcb(pitch: number | string, sound: string = "note.harp", octave: number | string = 5): ItemStack {
    const desc = `${sound};${octave};`;
    const is = ItemStack.allocate();
    const comtag = CompoundTag.allocateWith({
        "Count": ByteTag.allocateWith(1),
        "Damage": ShortTag.allocateWith(0),
        "Name": StringTag.allocateWith("minecraft:command_block"),
        "WasPickedUp": ByteTag.allocateWith(0),
        "tag": CompoundTag.allocateWith({
            "display": CompoundTag.allocateWith({
                "Lore": ListTag.allocateWith<StringTag>([
                    StringTag.allocateWith(desc)
                ])
            }),
            "auto": ByteTag.allocateWith(0),
            "conditionalMode": ByteTag.allocateWith(0),
            "conditionMet": ByteTag.allocateWith(0),
            "ExecuteOnFirstTick": ByteTag.allocateWith(0),
            "LPCondionalMode": ByteTag.allocateWith(0),
            "LPRedstoneMode": ByteTag.allocateWith(0),
            "powerd": ByteTag.allocateWith(0),
            "TrackOutput": ByteTag.allocateWith(0),
            "LPCommandMode": IntTag.allocateWith(0),
            "SuccessCount": IntTag.allocateWith(0),
            "TickDelay": IntTag.allocateWith(0),
            "Version": IntTag.allocateWith(17),
            "LastExecution": IntTag.allocateWith(0),
            "Command": StringTag.allocateWith(`playsound ${sound} @a ~~~ 10000.0 ${pitch} 0.0`), // is volume range?
            "CustomName": StringTag.allocateWith(desc),
            "LastOutput": StringTag.allocateWith("from NoteBlockUtil")
        })
    });
    is.load(comtag);
    comtag.dispose();
    return is;
}

command.register("nbu", "NoteBlockUtil", CommandPermissionLevel.Normal, 0, 0).overload(async (param, origin, output) => {
    // how to use output
    console.log("from:", origin.getName());
    const targets = param.target.newResults(origin);
    console.log(`${JSON.stringify(param)}, ${origin}, ${output}`);
    for (let actor of targets) {
        const tagsresult = await (await executeCommandAsync(`tag ${actor.getName()} list`)).data;
        if (tagsresult.statusCode != 0) continue;
        const tags = tagsresult.statusMessage.endsWith("has no tags") ? [] : tagsresult.statusMessage.split(": ")[1].replace(/§./g, "").split(", ")
        console.log(tags)
        const sound = param.sound ? param.sound.text : "note.harp";
        const octave = param.octave ? param.octave : 5;
        if (param.enable == tags.some(tag => tag.startsWith("nbu;"))) {
            if (!param.enable) {
                await executeCommandAsync(`tellraw ${actor.getName()} {"rawtext":[{"text":"[§dNoteBlockUtil§r] §cAlready disabled!§r"}]}`);
                continue;
            }
        } else if (param.enable) {
            tags.forEach(tag => { if (tag.startsWith("nbu;")) actor.removeTag(tag);});
            actor.addTag(`nbu;${sound};${octave};`);
        } else {
            tags.forEach(tag => { if (tag.startsWith("nbu;")) actor.removeTag(tag);});
            await executeCommandAsync(`tellraw ${actor.getName()} {"rawtext":[{"text":"[§dNoteBlockUtil§r] §aDisabled!§r"}]}`);
            continue;
        }

        const player = actor.getNetworkIdentifier().getActor();
        const inventory = player?.getInventory();
        const is = ItemStack.allocate();
        const comtag = CompoundTag.allocateWith({
            "Count": ByteTag.allocateWith(1),
            "Damage": ShortTag.allocateWith(0),
            "Name": StringTag.allocateWith("minecraft:compass"),
            "WasPickedUp": ByteTag.allocateWith(0),
            "tag": CompoundTag.allocateWith({
                "display": CompoundTag.allocateWith({
                    "Name": StringTag.allocateWith("Open NBU Menu")
                })
            })
        });
        is.load(comtag);
        comtag.dispose();
        inventory?.setItem(0, is, ContainerId.Inventory, true);
        inventory?.setItem(1, createcb(Math.pow(2.0, ((octave-5)*12+1-12.0)/12.0).toString().slice(0, 5), sound, octave), ContainerId.Inventory, true);
        inventory?.setItem(2, createcb(Math.pow(2.0, ((octave-5)*12+3-12.0)/12.0).toString().slice(0, 5), sound, octave), ContainerId.Inventory, true);
        inventory?.setItem(3, createcb(Math.pow(2.0, ((octave-5)*12+5-12.0)/12.0).toString().slice(0, 5), sound, octave), ContainerId.Inventory, true);
        inventory?.setItem(4, createcb(Math.pow(2.0, ((octave-5)*12+6-12.0)/12.0).toString().slice(0, 5), sound, octave), ContainerId.Inventory, true);
        inventory?.setItem(5, createcb(Math.pow(2.0, ((octave-5)*12+8-12.0)/12.0).toString().slice(0, 5), sound, octave), ContainerId.Inventory, true);
        inventory?.setItem(6, createcb(Math.pow(2.0, ((octave-5)*12+10-12.0)/12.0).toString().slice(0, 5), sound, octave), ContainerId.Inventory, true);
        inventory?.setItem(7, createcb(Math.pow(2.0, ((octave-5)*12+12-12.0)/12.0).toString().slice(0, 5), sound, octave), ContainerId.Inventory, true);
        player?.sendInventory(true);

        await executeCommandAsync(`tellraw ${actor.getName()} {"rawtext":[{"text":"[§dNoteBlockUtil§r] §aEnabled!§r"}]}`);
    }
}, {
    target: ActorWildcardCommandSelector,
    enable: bool_t,
    sound: [CommandRawText, true], // optional parameter
    octave: [int32_t, true]
});

events.entitySneak.on(async eventData => {
    if (eventData.entity.isPlayer()) {
        const actor = eventData.entity;
        const tagsresult = await (await executeCommandAsync(`tag ${actor.getName()} list`)).data;
        if (tagsresult.statusCode != 0) return;
        const tags = tagsresult.statusMessage.endsWith("has no tags") ? [] : tagsresult.statusMessage.split(": ")[1].replace(/§./g, "").split(", ")
        if (!tags.some(tag => tag.startsWith("nbu;"))) return;

        const inventory = actor.getInventory();
        const _sound_and_octave: any = tags.find(tag => tag.startsWith("nbu;"))?.split(";").slice(1, 3);
        const sound = _sound_and_octave[0];
        const octave = Number.parseInt(_sound_and_octave[1]);
        //console.log(_sound_and_octave)
        //console.log(tags)
        if (eventData.isSneaking) {
            inventory?.setItem(1, createcb(Math.pow(2.0, ((octave-5)*12+2-12.0)/12.0).toString().slice(0, 5), sound, octave), ContainerId.Inventory, true);
            inventory?.setItem(2, createcb(Math.pow(2.0, ((octave-5)*12+4-12.0)/12.0).toString().slice(0, 5), sound, octave), ContainerId.Inventory, true);
            inventory?.setItem(3, ItemStack.constructWith("minecraft:air"), ContainerId.Inventory, true);
            inventory?.setItem(4, createcb(Math.pow(2.0, ((octave-5)*12+7-12.0)/12.0).toString().slice(0, 5), sound, octave), ContainerId.Inventory, true);
            inventory?.setItem(5, createcb(Math.pow(2.0, ((octave-5)*12+9-12.0)/12.0).toString().slice(0, 5), sound, octave), ContainerId.Inventory, true);
            inventory?.setItem(6, createcb(Math.pow(2.0, ((octave-5)*12+11-12.0)/12.0).toString().slice(0, 5), sound, octave), ContainerId.Inventory, true);
            inventory?.setItem(7, ItemStack.constructWith("minecraft:air"), ContainerId.Inventory, true);
        } else {
            inventory?.setItem(1, createcb(Math.pow(2.0, ((octave-5)*12+1-12.0)/12.0).toString().slice(0, 5), sound, octave), ContainerId.Inventory, true);
            inventory?.setItem(2, createcb(Math.pow(2.0, ((octave-5)*12+3-12.0)/12.0).toString().slice(0, 5), sound, octave), ContainerId.Inventory, true);
            inventory?.setItem(3, createcb(Math.pow(2.0, ((octave-5)*12+5-12.0)/12.0).toString().slice(0, 5), sound, octave), ContainerId.Inventory, true);
            inventory?.setItem(4, createcb(Math.pow(2.0, ((octave-5)*12+6-12.0)/12.0).toString().slice(0, 5), sound, octave), ContainerId.Inventory, true);
            inventory?.setItem(5, createcb(Math.pow(2.0, ((octave-5)*12+8-12.0)/12.0).toString().slice(0, 5), sound, octave), ContainerId.Inventory, true);
            inventory?.setItem(6, createcb(Math.pow(2.0, ((octave-5)*12+10-12.0)/12.0).toString().slice(0, 5), sound, octave), ContainerId.Inventory, true);
            inventory?.setItem(7, createcb(Math.pow(2.0, ((octave-5)*12+12-12.0)/12.0).toString().slice(0, 5), sound, octave), ContainerId.Inventory, true);
        }
        actor.sendInventory();
    }
})

//whut
/*events.playerDropItem.on(eventData => {
    console.log(eventData.itemStack.getName())
    if (eventData.player.isPlayer() && (eventData.itemStack.getCustomName().toLowerCase() == "Open NBU Menu".toLowerCase() || eventData.itemStack.getName().toLowerCase() == "minecraft:command_block")) {
        //eventData.itemStack.setAmount(eventData.itemStack.getAmount());
        const is = eventData.itemStack.cloneItem();
        setTimeout(() => {
            if (eventData.player.isPlayer()) {
                eventData.player.getInventory().addItem(is, true);
                eventData.player.sendInventory(true);
            }
        }, 500);
        return CANCEL;
    }
})*/

onUseItem.on((ni, itemName, is) => {
    if (is.getCustomName().toLowerCase() == "Open NBU Menu".toLowerCase()) {
        (async function() {
            const actor = ni.getActor();
            const tagsresult = await (await executeCommandAsync(`tag ${actor?.getName()} list`)).data;
            if (tagsresult.statusCode != 0) return;
            const tags = tagsresult.statusMessage.endsWith("has no tags") ? [] : tagsresult.statusMessage.split(": ")[1].replace(/§./g, "").split(", ");
            if (!tags.some(tag => tag.startsWith("nbu;"))) return;
            const _sound_and_octave: any = tags.find(tag => tag.startsWith("nbu;"))?.split(";").slice(1, 3);
            const sound = _sound_and_octave[0];
            const octave = Number.parseInt(_sound_and_octave[1]);
            const sounds = [
                "note.harp",
                "note.bass",
                "note.banjo",
                "note.bassattack",
                "note.bd",
                "note.bell",
                "note.bit",
                "note.chime",
                "note.cow_bell",
                "note.didgeridoo",
                "note.flute",
                "note.guitar",
                "note.hat",
                "note.iron_xylophone",
                "note.pling",
                "note.snare",
                "note.xylophone",
                "random.orb",
                "random.levelup",
                "random.pop",
                "random.pop2"
            ];
            const form = new CustomForm();
            form.addComponent(new FormDropdown("Sound:", sounds, sounds.findIndex(s => s == sound) || 0));
            form.addComponent(new FormInput("Or custom sound:", "(from sound_definitions)", sounds.some(s => s == sound) ? "" : sound));
            form.addComponent(new FormSlider("Octave", 1, 12, 1, octave));
            form.sendTo(ni, async (form, ni) => {
                console.log(form.response)
                if (form.response != null) {
                    const sound = form.response[1] == "" ? sounds[form.response[0]] : form.response[1];
                    const octave = form.response[2];
                    tags.forEach(tag => { if (tag.startsWith("nbu;")) actor?.removeTag(tag);});
                    actor?.addTag(`nbu;${sound};${octave};`);
                    const inventory = actor?.getInventory();
                    const is = ItemStack.allocate();
                    const comtag = CompoundTag.allocateWith({
                        "Count": ByteTag.allocateWith(1),
                        "Damage": ShortTag.allocateWith(0),
                        "Name": StringTag.allocateWith("minecraft:compass"),
                        "WasPickedUp": ByteTag.allocateWith(0),
                        "tag": CompoundTag.allocateWith({
                            "display": CompoundTag.allocateWith({
                                "Name": StringTag.allocateWith("Open NBU Menu")
                            })
                        })
                    });
                    is.load(comtag);
                    comtag.dispose();
                    inventory?.setItem(0, is, ContainerId.Inventory, true);
                    inventory?.setItem(1, createcb(Math.pow(2.0, ((octave-5)*12+1-12.0)/12.0).toString().slice(0, 5), sound, octave), ContainerId.Inventory, true);
                    inventory?.setItem(2, createcb(Math.pow(2.0, ((octave-5)*12+3-12.0)/12.0).toString().slice(0, 5), sound, octave), ContainerId.Inventory, true);
                    inventory?.setItem(3, createcb(Math.pow(2.0, ((octave-5)*12+5-12.0)/12.0).toString().slice(0, 5), sound, octave), ContainerId.Inventory, true);
                    inventory?.setItem(4, createcb(Math.pow(2.0, ((octave-5)*12+6-12.0)/12.0).toString().slice(0, 5), sound, octave), ContainerId.Inventory, true);
                    inventory?.setItem(5, createcb(Math.pow(2.0, ((octave-5)*12+8-12.0)/12.0).toString().slice(0, 5), sound, octave), ContainerId.Inventory, true);
                    inventory?.setItem(6, createcb(Math.pow(2.0, ((octave-5)*12+10-12.0)/12.0).toString().slice(0, 5), sound, octave), ContainerId.Inventory, true);
                    inventory?.setItem(7, createcb(Math.pow(2.0, ((octave-5)*12+12-12.0)/12.0).toString().slice(0, 5), sound, octave), ContainerId.Inventory, true);
                    actor?.sendInventory(true);
                }
            });
        })();
        return CANCEL;
    }
});

events.blockPlace.on(eventData => {
    const player = eventData.player.getNetworkIdentifier().getActor()!;
    const pos = BlockPos.create(eventData.blockPos.x + 4, eventData.blockPos.y, eventData.blockPos.z);
    if (eventData.block.getName() == "minecraft:command_block") (async function() {
        const tagsresult = await (await executeCommandAsync(`tag ${player.getName()} list`)).data;
        if (tagsresult.statusCode != 0) return;
        const tags = tagsresult.statusMessage.endsWith("has no tags") ? [] : tagsresult.statusMessage.split(": ")[1].replace(/§./g, "").split(", ");
        if (!tags.some(tag => tag.startsWith("nbu;"))) return;
        if (!tags.some(tag => tag.startsWith("_dnbu;"))) return;
        const _sound_and_octave: any = tags.find(tag => tag.startsWith("nbu;"))?.split(";").slice(1, 3);
        const sound = _sound_and_octave[0];
        const octave = Number.parseInt(_sound_and_octave[1]);
        function gp(i: number, s: Boolean): number {
            switch (i) {
                case 1: return s?2:1
                case 2: return s?4:3
                case 3: return 5
                case 4: return s?7:6
                case 5: return s?9:8
                case 6: return s?11:10
                case 7: return 12
                default: return 0
            }
        }
        const sn = gp(player.getInventory().getSelectedSlot(), player.isSneaking());
        console.log(sn);
        const bs = player.getRegion();
        bs.setBlock(pos, Block.constructWith("minecraft:command_block", 1)!);
        const ba = bs.getBlockEntity(pos)!;
        const comtag = CompoundTag.allocate();
        ba.save(comtag);
        comtag.set("Command", StringTag.allocateWith(`playsound ${sound} @a ~~~ 10000.0 ${Math.pow(2.0, ((octave-5+1)*12+sn-12.0)/12.0).toString().slice(0, 5)} 0.0`));
        comtag.set("CustomName", StringTag.allocateWith(`${sound};${octave+1};`));
        ba.load(comtag);
        comtag.dispose();
    })();
});

command.register("nbuplay", "NoteBlockUtil / Play", CommandPermissionLevel.Normal, 0, 0).overload(async (param, origin, output) => {
    /*const redstone_some: Block = Block.constructWith("minecraft:redstone_torch") as Block;
    let olds: Block[] = [];
    let news: Block[] = [];
    for (let j = 0; j < param.ze - param.zs; j++) news.push(serverInstance.minecraft.getLevel().getDimension(DimensionId.Overworld)?.getBlockSource().getBlock(BlockPos.create(param.xs, param.y, param.zs + j)) as Block);
    for (let i = 0; i < param.xe - param.xs; i++) {
        olds = news.concat();
        news = [];
        let bs: BlockSource = serverInstance.minecraft.getLevel().getDimension(DimensionId.Overworld)?.getBlockSource() as BlockSource;
        for (let j = 0; j < param.ze - param.zs; j++) {
            news.push(bs.getBlock(BlockPos.create(param.xs + i, param.y, param.zs + j)));
            bs.setBlock(BlockPos.create(param.xs + i - 1, param.y, param.zs + j), olds[j]);
            bs.setBlock(BlockPos.create(param.xs + i, param.y, param.zs + j), redstone_some);
        }
        olds = [];
        await sleep((60/param.bpm)*1000/8);
    }*/
    const dimension = serverInstance.minecraft.getLevel().getDimension(DimensionId.Overworld);
    const redstone_lamp = Block.constructWith("minecraft:redstone_lamp")!;
    const redstone_lit_lamp = Block.constructWith("minecraft:lit_redstone_lamp")!;
    let v = 0;
    for (let i = -1; i < param.xe - param.xs; i++) {
        let bs: BlockSource = dimension!.getBlockSource();
        for (let j = 0; j < param.ze - param.zs + 1; j++) {
            let pos = BlockPos.create(param.xs + i, param.y, param.zs + j);
            let block = bs.getBlock(pos);
            if (block.getName() == "minecraft:command_block") {
                const comtag = CompoundTag.allocate();
                bs.getBlockEntity(pos)?.save(comtag);
                //console.log(comtag);
                //console.log((comtag.get("Command") as StringTag).data);
                const command = (comtag.get("Command") as StringTag).data;
                if (command.startsWith("playsound")) {
                    const c = command.split(" ");
                    const packet = PlaySoundPacket.create();
                    packet.soundName = c[1];
                    packet.volume = eval(c[4]);
                    packet.pitch = eval(c[5]);
                    serverInstance.getPlayers().forEach(player => {
                        const pos = player.getPosition();
                        //console.log(`${player.getName()} ${JSON.stringify(pos.toJSON())}`);
                        packet.pos.x = pos.x * 8;
                        packet.pos.y = pos.y * 8;
                        packet.pos.z = pos.z * 8;
                        player.sendPacket(packet);
                    });
                    //const cmd = "execute @a ~~~ " + command.replace("@a", "@s");
                    //executeCommandAsync(cmd);
                } else executeCommandAsync(command);
                comtag.dispose();
                //comtag.destruct();
                //capi.free(comtag);
            }
            bs.setBlock(BlockPos.create(param.xs + i, param.y - 1, param.zs + j), Block.constructWith("minecraft:wool", v%param.division)!);
        }
        bs.setBlock(BlockPos.create(param.xs + i, param.y - 1, param.zs - 1), redstone_lamp);
        bs.setBlock(BlockPos.create(param.xs + i - 1, param.y - 1, param.zs - 1), redstone_lit_lamp);
        v++;
        await sleep((60/param.bpm)*1000/param.division);
    }
    return param;
}, {
    "bpm": int32_t,
    "division": int32_t,
    "zs": int32_t,
    "ze": int32_t,
    "y": int32_t,
    "xs": int32_t,
    "xe": int32_t
});

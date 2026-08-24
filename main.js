import { world, system, EquipmentSlot } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

const waypoints = new Map();
const activeParticleTrail = new Map();
const radarActive = new Set();

// --- Combat & PvP Customization ---
const armorHudActive = new Set();
const autoTotemActive = new Set();
const damageIndicatorsActive = new Set();
const pearlCooldowns = new Map();

// --- PvP Visual & Client Toggles ---
const noHurtCamActive = new Set();
const itemPhysicsActive = new Set();
const motionBlurActive = new Set();
const invisibleActive = new Set(); 

// --- Client Utility Toggles ---
const fullbrightActive = new Set();
const autoSprintActive = new Set();
const sTapActive = new Set();
const wTapActive = new Set();
const waliaActive = new Set(); 

const tapStateMap = new Map(); 

// --- Builder Modules ---
const wandCorners = new Map(); 
const activeBrush = new Map(); 
const playerBlueprints = new Map(); 

// --- Particle Library ---
const rainbowColors = [
    { name: "Red", particleId: "minecraft:crit_particle" },
    { name: "Gold / Orange", particleId: "minecraft:lava_particle" },
    { name: "Yellow", particleId: "minecraft:villager_happy" },
    { name: "Green", particleId: "minecraft:wax_particle" },
    { name: "Cyan / Light Blue", particleId: "minecraft:water_drip_particle" },
    { name: "Blue", particleId: "minecraft:note_particle" },
    { name: "Purple / Magenta", particleId: "minecraft:portal_reverse_particle" },
    { name: "White / Silver", particleId: "minecraft:endrod" }
];

const particleOptions = [
    { name: "§fEnd Rod Sparkle", particleId: "minecraft:endrod", yOffset: 0.1 },
    { name: "§cHearing Hearts", particleId: "minecraft:heart_particle", yOffset: 1.5 },
    { name: "§bBlue Note Melody", particleId: "minecraft:note_particle", yOffset: 1.5 },
    { name: "§6Mob Flame Trail", particleId: "minecraft:mobflame_single", yOffset: 0.1 },
    { name: "§4Redstone Dust Glow", particleId: "minecraft:redstone_ore_dust_particle", yOffset: 0.1 },
    { name: "§eVillager Happy Sparkles", particleId: "minecraft:villager_happy", yOffset: 0.8 },
    { name: "§3Water Drip Droplets", particleId: "minecraft:water_drip_particle", yOffset: 1.0 },
    { name: "§6Lava Ember Spark", particleId: "minecraft:lava_particle", yOffset: 0.1 },
    { name: "§eTotem Golden Revival", particleId: "minecraft:totem_particle", yOffset: 1.0 },
    { name: "§aSpore Blossom Falling", particleId: "minecraft:spore_blossom_ambient_particle", yOffset: 2.0 },
    { name: "§aWax Oxidation Speck", particleId: "minecraft:wax_particle", yOffset: 1.0 },
    { name: "§bElectric Spark", particleId: "minecraft:electric_spark_particle", yOffset: 1.0 }
];

world.afterEvents.itemUse.subscribe((eventData) => {
    const player = eventData.source;
    const item = eventData.itemStack;

    if (item.typeId === "minecraft:compass") {
        openMainMenu(player);
    }
    
    if (item.typeId === "minecraft:feather") {
        const pName = player.name;
        if (sTapActive.has(pName)) {
            sTapActive.delete(pName);
            wTapActive.delete(pName);
            player.sendMessage("§c[Macro] §fAuto S-Tap & W-Tap: §cDISABLED");
        } else {
            sTapActive.add(pName);
            wTapActive.add(pName);
            player.sendMessage("§a[Macro] §fAuto S-Tap & W-Tap: §aENABLED");
        }
    }

    if (item.typeId === "minecraft:ender_pearl") {
        pearlCooldowns.set(player.name, Date.now() + 15000);
    }
});

world.afterEvents.itemUseOn.subscribe((eventData) => {
    const player = eventData.source;
    const item = eventData.itemStack;
    const blockLoc = eventData.block.location;

    if (item.typeId === "minecraft:wooden_axe") {
        const pLocs = wandCorners.get(player.name) || {};
        pLocs.pos1 = blockLoc;
        wandCorners.set(player.name, pLocs);
        player.sendMessage(`§9[Builder Tool] §fPosition 1 set to: §e${blockLoc.x}, ${blockLoc.y}, ${blockLoc.z}`);
    }

    if (item.typeId === "minecraft:bone_meal") {
        const brushType = activeBrush.get(player.name);
        const dim = player.dimension;

        if (brushType === "tree") {
            for (let y = 1; y <= 6; y++) {
                try { dim.getBlock({ x: blockLoc.x, y: blockLoc.y + y, z: blockLoc.z }).setType("minecraft:oak_log"); } catch (e) {}
            }
            for (let x = -2; x <= 2; x++) {
                for (let z = -2; z <= 2; z++) {
                    for (let y = 4; y <= 7; y++) {
                        if (y === 7 && (Math.abs(x) === 2 || Math.abs(z) === 2)) continue;
                        if (y === 6 && Math.abs(x) === 2 && Math.abs(z) === 2) continue;
                        try {
                            const b = dim.getBlock({ x: blockLoc.x + x, y: blockLoc.y + y, z: blockLoc.z + z });
                            if (b && b.typeId === "minecraft:air") b.setType("minecraft:oak_leaves");
                        } catch (e) {}
                    }
                }
            }
            player.sendMessage("§9[Builder Tool] §fNatural tree spawned via brush!");
        } else if (brushType === "flora") {
            for (let x = -2; x <= 2; x++) {
                for (let z = -2; z <= 2; z++) {
                    if (Math.random() > 0.4) {
                        try {
                            const target = dim.getBlock({ x: blockLoc.x + x, y: blockLoc.y + 1, z: blockLoc.z + z });
                            if (target && target.typeId === "minecraft:air") {
                                const floraTypes = ["minecraft:short_grass", "minecraft:dandelion", "minecraft:poppy", "minecraft:cornflower"];
                                target.setType(floraTypes[Math.floor(Math.random() * floraTypes.length)]);
                            }
                        } catch (e) {}
                    }
                }
            }
            player.sendMessage("§9[Builder Tool] §fFlora cluster spawned via brush!");
        }
    }
});

world.afterEvents.entityHurt.subscribe((eventData) => {
    const attacker = eventData.damageSource.damagingEntity;
    const target = eventData.hurtEntity;

    if (target && target.typeId === "minecraft:player" && noHurtCamActive.has(target.name)) {
        try { target.runCommandAsync("effect @s resistance 1 255 true"); } catch (e) {}
    }

    if (attacker && attacker.typeId === "minecraft:player") {
        const playerName = attacker.name;
        
        if (damageIndicatorsActive.has(playerName)) {
            const damageAmt = Math.round(eventData.damage);
            const pos = target.location;
            try {
                attacker.dimension.spawnParticle("minecraft:crit_particle", { x: pos.x, y: pos.y + 1.8, z: pos.z });
                attacker.sendMessage(`§7[§c-${damageAmt} HP§7] -> ${target.nameTag || target.typeId.replace("minecraft:", "")}`);
            } catch (e) {}
        }

        if (sTapActive.has(playerName) || wTapActive.has(playerName)) {
            tapStateMap.set(playerName, { active: true, duration: 2 });
            try {
                const viewDir = attacker.getViewDirection();
                const multiplier = sTapActive.has(playerName) ? -0.15 : -0.08;
                attacker.applyKnockback(viewDir.x, viewDir.z, 0, multiplier);
            } catch (e) {}
        }
    }
});

let tickCounter = 0;

system.runInterval(() => {
    tickCounter++;
    const runParticles = (tickCounter % 3 === 0); 
    const runSlowChecks = (tickCounter % 10 === 0); 

    for (const player of world.getAllPlayers()) {
        const playerName = player.name;

        if (runSlowChecks) {
            let hudString = ""; 
            if (armorHudActive.has(playerName)) {
                try {
                    const equippable = player.getComponent("equippable");
                    const getDurability = (item) => {
                        if (!item) return "§7-";
                        const d = item.getComponent("durability");
                        if (!d) return "§a100%";
                        return `§e${Math.round(((d.maxDurability - d.damage) / d.maxDurability) * 100)}%`;
                    };
                    const h = getDurability(equippable?.getEquipment(EquipmentSlot.Head));
                    const c = getDurability(equippable?.getEquipment(EquipmentSlot.Chest));
                    const l = getDurability(equippable?.getEquipment(EquipmentSlot.Legs));
                    const b = getDurability(equippable?.getEquipment(EquipmentSlot.Feet));
                    hudString = `§fH:${h} C:${c} L:${l} B:${b}`;
                } catch (e) {}
            }
            if (hudString !== "") {
                player.onScreenDisplay.setActionBar(hudString);
            }
        } else {
            checkPearlCooldown(player);
        }

        if (fullbrightActive.has(playerName) && runSlowChecks) {
            try { player.addEffect("night_vision", 250, { amplifier: 0, showParticles: false }); } catch (e) {}
        }

        if (autoSprintActive.has(playerName) && runSlowChecks) {
            try { player.addEffect("speed", 30, { amplifier: 0, showParticles: false }); } catch (e) {}
        }

        if (motionBlurActive.has(playerName) && runSlowChecks) {
            try { player.runCommandAsync("effect @s nausea 2 0 true"); } catch (e) {}
        }

        if (invisibleActive.has(playerName) && runSlowChecks) {
            try { player.addEffect("invisibility", 250, { amplifier: 0, showParticles: false }); } catch (e) {}
        }

        const tapInfo = tapStateMap.get(playerName);
        if (tapInfo && tapInfo.active) {
            tapInfo.duration--;
            if (tapInfo.duration <= 0) {
                tapStateMap.delete(playerName);
            }
        }

        if (waliaActive.has(playerName) && runSlowChecks) {
            try {
                const hitBlock = player.getBlockFromViewDirection({ maxDistance: 5 });
                if (hitBlock && hitBlock.block) {
                    player.onScreenDisplay.setActionBar(`§bTarget: §f${hitBlock.block.typeId.replace("minecraft:", "")}`);
                }
            } catch (e) {}
        }

        if (autoTotemActive.has(playerName) && runSlowChecks) {
            try {
                const equippable = player.getComponent("equippable");
                const offhandItem = equippable?.getEquipment(EquipmentSlot.Offhand);
                if (!offhandItem || offhandItem.typeId !== "minecraft:totem_of_undying") {
                    const inventory = player.getComponent("inventory").container;
                    for (let slot = 0; slot < inventory.size; slot++) {
                        const item = inventory.getItem(slot);
                        if (item && item.typeId === "minecraft:totem_of_undying") {
                            equippable.setEquipment(EquipmentSlot.Offhand, item);
                            inventory.setItem(slot, undefined);
                            break;
                        }
                    }
                }
            } catch (e) {}
        }

        if (radarActive.has(playerName) && runSlowChecks) {
            try {
                const nearbyEntities = player.dimension.getEntities({ location: player.location, maxDistance: 24, excludeTypes: ["minecraft:item"] });
                for (const entity of nearbyEntities) {
                    if (entity.id === player.id) continue;
                    const ePos = entity.location;
                    player.dimension.spawnParticle("minecraft:villager_happy", { x: ePos.x, y: ePos.y + 0.1, z: ePos.z });
                }
            } catch (e) {}
        }

        if (selectedParticleHandler(playerName, runParticles)) {}
    }
}, 1);

function selectedParticleHandler(playerName, runParticles) {
    if (!runParticles) return false;
    const selectedTrail = activeParticleTrail.get(playerName);
    if (selectedTrail) {
        const player = world.getAllPlayers().find(p => p.name === playerName);
        if (player) {
            const pos = player.location;
            try {
                player.dimension.spawnParticle(selectedTrail.particleId, { 
                    x: pos.x, 
                    y: pos.y + selectedTrail.yOffset, 
                    z: pos.z 
                });
            } catch (e) {}
        }
    }
    return true;
}

function checkPearlCooldown(player) {
    const expireTime = pearlCooldowns.get(player.name);
    if (expireTime) {
        const remaining = Math.max(0, Math.ceil((expireTime - Date.now()) / 1000));
        if (remaining > 0) player.onScreenDisplay.setActionBar(`§eEnder Pearl Cooldown: §c${remaining}s`);
        else { pearlCooldowns.delete(player.name); player.onScreenDisplay.setActionBar(`§aEnder Pearl Ready!`); }
    }
}

// ==================== MAIN MENU & MODULES ====================
function openMainMenu(player) {
    const form = new ActionFormData()
        .title("§l§bJunie Client §8v6.9.2")
        .body("§dThanks for using Junie Client! §fSelect a feature module below:")
        .button("§l§9Builder & Architect Tools")
        .button("§l§9PvP & Combat Modules")
        .button("§l§bStat Buffs & Effects")
        .button("§l§bFOV & Render Settings")
        .button("§l§bWaypoints & Teleport")
        .button("§l§bTime & Weather")
        .button("§l§dParticle Trails & Auras")
        .button("§l§bEntity Radar")
        .button("§l§cClose");

    form.show(player).then((res) => {
        if (res.canceled || res.selection === 8) return;
        switch (res.selection) {
            case 0: openBuilderMenu(player); break;
            case 1: openCombatMenu(player); break;
            case 2: openEffectsMenu(player); break;
            case 3: openFovRenderMenu(player); break;
            case 4: openTeleportMenu(player); break;
            case 5: openWorldMenu(player); break;
            case 6: openParticleMenu(player); break;
            case 7: openRadarMenu(player); break;
        }
    });
}

function openBuilderMenu(player) {
    const form = new ActionFormData()
        .title("§l§aBuilder & Architect Tools")
        .body("Select an option below to view detailed usage instructions in chat:")
        .button("§l§9Set Position 2")
        .button("§l§9Fill Selection (Stone)")
        .button("§l§9Clear Selection (Air)")
        .button("§l§9Brush: Natural Trees")
        .button("§l§9Brush: Flora Clusters")
        .button("§l§9Disable Brush")
        .button("§l§9Copy Blueprint")
        .button("§l§9Paste Blueprint")
        .button("§l§9Rotate Blueprint (90°)")
        .button("§l§9Hollow Selection Box")
        .button("§l§9Build Support Pillar")
        .button("§l§9Texturize Area")
        .button("§l§9Back");

    form.show(player).then((res) => {
        if (res.canceled || res.selection === 12) { openMainMenu(player); return; }
        switch (res.selection) {
            case 0:
                const curLoc = { x: Math.floor(player.location.x), y: Math.floor(player.location.y), z: Math.floor(player.location.z) };
                const pLocs = wandCorners.get(player.name) || {};
                pLocs.pos2 = curLoc;
                wandCorners.set(player.name, pLocs);
                player.sendMessage(`§9[Guide - Set Pos 2] §fUsed to define the second corner of your selection box.`);
                player.sendMessage(`§7How to use: Stand where you want the second corner to be and click this button.`);
                player.sendMessage(`§7Example: If Pos 1 is at ground level, stand 5 blocks away and click this to set Pos 2 at §e${curLoc.x}, ${curLoc.y}, ${curLoc.z}`);
                break;
            case 1: 
                fillWandArea(player, "minecraft:stone"); 
                player.sendMessage(`§9[Guide - Fill Selection] §fFills your entire Pos 1 to Pos 2 selection with solid blocks.`);
                player.sendMessage(`§7How to use: Set both Pos 1 (with wooden axe) and Pos 2 (from menu), then click this.`);
                player.sendMessage(`§7Example: Turns a selected cube area entirely into solid §estone§f blocks instantly.`);
                break;
            case 2: 
                fillWandArea(player, "minecraft:air"); 
                player.sendMessage(`§9[Guide - Clear Selection] §fDeletes all blocks inside your selection box, turning them into air.`);
                player.sendMessage(`§7How to use: Define your area bounds with Pos 1 and Pos 2, then click this to clear it out.`);
                player.sendMessage(`§7Example: Quickly excavate a room by turning an entire dirt/stone zone into §eair§f.`);
                break;
            case 3: 
                activeBrush.set(player.name, "tree"); 
                player.sendMessage(`§9[Guide - Tree Brush] §fSpawns custom natural trees wherever you click using bone meal.`);
                player.sendMessage(`§7How to use: Hold §eBone Meal§f and right-click on any block surface.`);
                player.sendMessage(`§7Example: Right-clicking a grass block instantly generates a detailed oak tree structure right there.`);
                break;
            case 4: 
                activeBrush.set(player.name, "flora"); 
                player.sendMessage(`§9[Guide - Flora Brush] §fSpawns random clusters of grass and flowers around your click point.`);
                player.sendMessage(`§7How to use: Hold §eBone Meal§f and right-click on dirt or grass.`);
                player.sendMessage(`§7Example: Right-clicking a patch of land instantly scatters tall grass, dandelions, and poppies around it.`);
                break;
            case 5: 
                activeBrush.delete(player.name); 
                player.sendMessage(`§9[Guide - Disable Brush] §fTurns off active brushes so your bone meal behaves like normal vanilla Minecraft.`);
                player.sendMessage(`§7How to use: Click this to safely stop tree/flora spawning before gardening normally.`);
                player.sendMessage(`§7Example: Restores regular crop-growing behavior when holding bone meal.`);
                break;
            case 6: 
                copyWandArea(player); 
                player.sendMessage(`§9[Guide - Copy Blueprint] §fSaves a precise structural copy of everything inside your Pos 1 and Pos 2 bounds.`);
                player.sendMessage(`§7How to use: Select your build region using the wand and Pos 2, then click copy.`);
                player.sendMessage(`§7Example: Copying a small medieval house roof to duplicate it elsewhere.`);
                break;
            case 7: 
                pasteBlueprint(player); 
                player.sendMessage(`§9[Guide - Paste Blueprint] §fInstantly builds your copied structure relative to your exact current location.`);
                player.sendMessage(`§7How to use: Stand where you want the building's corner to appear and click paste.`);
                player.sendMessage(`§7Example: Duplicating your saved house design onto a mountain top.`);
                break;
            case 8: 
                rotateBlueprint(player); 
                player.sendMessage(`§9[Guide - Rotate Blueprint] §fTurns your copied structure 90 degrees clockwise in memory.`);
                player.sendMessage(`§7How to use: Click this before pasting if your structure needs to face a different direction.`);
                player.sendMessage(`§7Example: Rotating a front doorway from facing North to facing East before pasting.`);
                break;
            case 9: 
                hollowWandArea(player); 
                player.sendMessage(`§9[Guide - Hollow Selection] §fRemoves all interior blocks inside your selection box, leaving only the outer shell.`);
                player.sendMessage(`§7How to use: Select a solid filled cube box with Pos 1 and Pos 2, then click this.`);
                player.sendMessage(`§7Example: Instantly turning a solid stone cube into an empty hollow room you can live in.`);
                break;
            case 10: 
                buildPillarDown(player, "minecraft:stone"); 
                player.sendMessage(`§9[Guide - Support Pillar] §fBuilds a vertical column straight down from your feet until it hits solid ground.`);
                player.sendMessage(`§7How to use: Stand on a floating platform or high in the air and click this option.`);
                player.sendMessage(`§7Example: Building a bridge across a massive canyon and dropping instant support pillars underneath.`);
                break;
            case 11: 
                texturizeArea(player); 
                player.sendMessage(`§9[Guide - Texturize Area] §fRandomly mixes up block types inside your selection to add realistic detail.`);
                player.sendMessage(`§7How to use: Select a plain wall or floor structure, then click this.`);
                player.sendMessage(`§7Example: Turning a boring flat wall made entirely of smooth stone into a textured blend of stone, cobblestone, and andesite.`);
                break;
        }
    });
}

function fillWandArea(player, blockType) {
    const pLocs = wandCorners.get(player.name);
    if (!pLocs || !pLocs.pos1 || !pLocs.pos2) return;
    const dim = player.dimension;
    const minX = Math.min(pLocs.pos1.x, pLocs.pos2.x), maxX = Math.max(pLocs.pos1.x, pLocs.pos2.x);
    const minY = Math.min(pLocs.pos1.y, pLocs.pos2.y), maxY = Math.max(pLocs.pos1.y, pLocs.pos2.y);
    const minZ = Math.min(pLocs.pos1.z, pLocs.pos2.z), maxZ = Math.max(pLocs.pos1.z, pLocs.pos2.z);

    for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            for (let z = minZ; z <= maxZ; z++) {
                try { dim.getBlock({ x, y, z })?.setType(blockType); } catch (e) {}
            }
        }
    }
    player.sendMessage(`§9[Builder Tool] §fArea filled with ${blockType}!`);
}

function copyWandArea(player) {
    const pLocs = wandCorners.get(player.name);
    if (!pLocs || !pLocs.pos1 || !pLocs.pos2) return;
    const dim = player.dimension;
    const blocks = [];
    const minX = Math.min(pLocs.pos1.x, pLocs.pos2.x), maxX = Math.max(pLocs.pos1.x, pLocs.pos2.x);
    const minY = Math.min(pLocs.pos1.y, pLocs.pos2.y), maxY = Math.max(pLocs.pos1.y, pLocs.pos2.y);
    const minZ = Math.min(pLocs.pos1.z, pLocs.pos2.z), maxZ = Math.max(pLocs.pos1.z, pLocs.pos2.z);

    for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            for (let z = minZ; z <= maxZ; z++) {
                try {
                    const b = dim.getBlock({ x, y, z });
                    if (b) blocks.push({ relX: x - minX, relY: y - minY, relZ: z - minZ, type: b.typeId });
                } catch (e) {}
            }
        }
    }
    playerBlueprints.set(player.name, blocks);
    player.sendMessage(`§9[Builder Tool] §fCopied §e${blocks.length} §fblocks!`);
}

function pasteBlueprint(player) {
    const blueprint = playerBlueprints.get(player.name);
    if (!blueprint) return;
    const dim = player.dimension;
    const base = { x: Math.floor(player.location.x), y: Math.floor(player.location.y), z: Math.floor(player.location.z) };
    for (const b of blueprint) {
        try { dim.getBlock({ x: base.x + b.relX, y: base.y + b.relY, z: base.z + b.relZ })?.setType(b.type); } catch (e) {}
    }
    player.sendMessage("§9[Builder Tool] §fBlueprint pasted!");
}

function rotateBlueprint(player) {
    const blueprint = playerBlueprints.get(player.name);
    if (!blueprint) return;
    const rotated = blueprint.map(b => ({ relX: -b.relZ, relY: b.relY, relZ: b.relX, type: b.type }));
    playerBlueprints.set(player.name, rotated);
    player.sendMessage("§9[Builder Tool] §fRotated blueprint 90° clockwise!");
}

function hollowWandArea(player) {
    const pLocs = wandCorners.get(player.name);
    if (!pLocs || !pLocs.pos1 || !pLocs.pos2) return;
    const dim = player.dimension;
    const minX = Math.min(pLocs.pos1.x, pLocs.pos2.x), maxX = Math.max(pLocs.pos1.x, pLocs.pos2.x);
    const minY = Math.min(pLocs.pos1.y, pLocs.pos2.y), maxY = Math.max(pLocs.pos1.y, pLocs.pos2.y);
    const minZ = Math.min(pLocs.pos1.z, pLocs.pos2.z), maxZ = Math.max(pLocs.pos1.z, pLocs.pos2.z);

    for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            for (let z = minZ; z <= maxZ; z++) {
                if (!(x === minX || x === maxX || y === minY || y === maxY || z === minZ || z === maxZ)) {
                    try { dim.getBlock({ x, y, z })?.setType("minecraft:air"); } catch (e) {}
                }
            }
        }
    }
    player.sendMessage("§9[Builder Tool] §fArea hollowed out!");
}

function buildPillarDown(player, blockType) {
    const dim = player.dimension;
    const loc = player.location;
    let currentY = Math.floor(loc.y) - 1;
    while (currentY >= -64) {
        const b = dim.getBlock({ x: Math.floor(loc.x), y: currentY, z: Math.floor(loc.z) });
        if (b && (b.typeId === "minecraft:air" || b.typeId === "minecraft:water")) {
            b.setType(blockType);
            currentY--;
        } else break;
    }
    player.sendMessage("§9[Builder Tool] §fSupport pillar built!");
}

function texturizeArea(player) {
    const pLocs = wandCorners.get(player.name);
    if (!pLocs || !pLocs.pos1 || !pLocs.pos2) return;
    const dim = player.dimension;
    const palette = ["minecraft:stone", "minecraft:cobblestone", "minecraft:andesite", "minecraft:smooth_stone"];
    const minX = Math.min(pLocs.pos1.x, pLocs.pos2.x), maxX = Math.max(pLocs.pos1.x, pLocs.pos2.x);
    const minY = Math.min(pLocs.pos1.y, pLocs.pos2.y), maxY = Math.max(pLocs.pos1.y, pLocs.pos2.y);
    const minZ = Math.min(pLocs.pos1.z, pLocs.pos2.z), maxZ = Math.max(pLocs.pos1.z, pLocs.pos2.z);

    for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            for (let z = minZ; z <= maxZ; z++) {
                try {
                    const block = dim.getBlock({ x, y, z });
                    if (block && block.typeId !== "minecraft:air") {
                        block.setType(palette[Math.floor(Math.random() * palette.length)]);
                    }
                } catch (e) {}
            }
        }
    }
    player.sendMessage("§9[Builder Tool] §fArea texturized!");
}

function openCombatMenu(player) {
    const pName = player.name;
    const form = new ActionFormData()
        .title("§l§cCombat & PvP Modules")
        .body("Toggle competitive and movement utility mods:")
        .button(fullbrightActive.has(pName) ? "§l§aDisable Fullbright" : "§l§cEnable Fullbright")
        .button(autoSprintActive.has(pName) ? "§l§aDisable Auto Sprint" : "§l§cEnable Auto Sprint")
        .button(sTapActive.has(pName) ? "§l§aDisable Auto S-Tap" : "§l§cEnable Auto S-Tap")
        .button(wTapActive.has(pName) ? "§l§aDisable Auto W-Tap" : "§l§cEnable Auto W-Tap")
        .button(noHurtCamActive.has(pName) ? "§l§cDisable No Hurt Cam" : "§l§aEnable No Hurt Cam")
        .button(itemPhysicsActive.has(pName) ? "§l§cDisable Item Physics" : "§l§aEnable Item Physics")
        .button(motionBlurActive.has(pName) ? "§l§cDisable Motion Blur" : "§l§aEnable Motion Blur")
        .button(invisibleActive.has(pName) ? "§l§cDisable Invisibility" : "§l§aEnable Invisibility")
        .button(waliaActive.has(pName) ? "§l§aDisable Walia HUD" : "§l§aEnable Walia HUD")
        .button(armorHudActive.has(pName) ? "§l§9Disable Armor HUD" : "§l§9Enable Armor HUD")
        .button(autoTotemActive.has(pName) ? "§l§9Disable Auto-Totem" : "§l§9Enable Auto-Totem")
        .button(damageIndicatorsActive.has(pName) ? "§l§9Disable Damage Indicators" : "§l§9Enable Damage Indicators")
        .button("§l§9Back");

    form.show(player).then((res) => {
        if (res.canceled || res.selection === 12) { openMainMenu(player); return; }
        switch (res.selection) {
            case 0: fullbrightActive.has(pName) ? fullbrightActive.delete(pName) : fullbrightActive.add(pName); break;
            case 1: autoSprintActive.has(pName) ? autoSprintActive.delete(pName) : autoSprintActive.add(pName); break;
            case 2: sTapActive.has(pName) ? sTapActive.delete(pName) : sTapActive.add(pName); break;
            case 3: wTapActive.has(pName) ? wTapActive.delete(pName) : wTapActive.add(pName); break;
            case 4: noHurtCamActive.has(pName) ? noHurtCamActive.delete(pName) : noHurtCamActive.add(pName); break;
            case 5: itemPhysicsActive.has(pName) ? itemPhysicsActive.delete(pName) : itemPhysicsActive.add(pName); break;
            case 6: motionBlurActive.has(pName) ? motionBlurActive.delete(pName) : motionBlurActive.add(pName); break;
            case 7: 
                if (invisibleActive.has(pName)) {
                    invisibleActive.delete(pName);
                    try { player.removeEffect("invisibility"); } catch (e) {}
                    player.sendMessage("§c[Client] §fInvisibility: §cDISABLED");
                } else {
                    invisibleActive.add(pName);
                    player.sendMessage("§a[Client] §fInvisibility: §aENABLED");
                }
                break;
            case 8: waliaActive.has(pName) ? waliaActive.delete(pName) : waliaActive.add(pName); break;
            case 9: armorHudActive.has(pName) ? armorHudActive.delete(pName) : armorHudActive.add(pName); break;
            case 10: autoTotemActive.has(pName) ? autoTotemActive.delete(pName) : autoTotemActive.add(pName); break;
            case 11: damageIndicatorsActive.has(pName) ? damageIndicatorsActive.delete(pName) : damageIndicatorsActive.add(pName); break;
        }
    });
}

function openEffectsMenu(player) {
    const form = new ActionFormData()
        .title("§l§bStat Buffs & Effects")
        .button("§l§9Speed II")
        .button("§l§9Jump Boost II")
        .button("§l§9Night Vision")
        .button("§l§9Strength II")
        .button("§l§9Clear All Effects")
        .button("§l§9Back");

    form.show(player).then((res) => {
        if (res.canceled || res.selection === 5) { openMainMenu(player); return; }
        if (res.selection === 0) player.addEffect("speed", 2400, { amplifier: 1 });
        if (res.selection === 1) player.addEffect("jump_boost", 2400, { amplifier: 1 });
        if (res.selection === 2) player.addEffect("night_vision", 6000, { amplifier: 0 });
        if (res.selection === 3) player.addEffect("strength", 2400, { amplifier: 1 });
        if (res.selection === 4) player.clearRunEffects();
    });
}

function openFovRenderMenu(player) {
    const form = new ModalFormData()
        .title("§l§bFOV & Render Settings")
        .slider("Select Field of View Multiplier", 70, 110, 1, 85);

    form.show(player).then((res) => {
        if (res.canceled) { openMainMenu(player); return; }
        const fovVal = res.formValues[0];
        player.sendMessage(`§9[Junie Client] §fFOV configured to §e${fovVal}`);
        openMainMenu(player);
    });
}

function openTeleportMenu(player) {
    const form = new ActionFormData()
        .title("§l§bWaypoints & Teleport")
        .button("§l§9Save Current Position as Waypoint")
        .button("§l§9Teleport to Saved Waypoint")
        .button("§l§9Back");

    form.show(player).then((res) => {
        if (res.canceled || res.selection === 2) { openMainMenu(player); return; }
        if (res.selection === 0) {
            const modal = new ModalFormData()
                .title("Save Waypoint")
                .textField("Enter Waypoint Name:", "Base, Home, PvP Arena");
            modal.show(player).then((mRes) => {
                if (mRes.canceled) return;
                const name = mRes.formValues[0];
                if (name) {
                    waypoints.set(`${player.name}_${name}`, player.location);
                    player.sendMessage(`§9[Junie Client] §fWaypoint §e${name} §fsaved!`);
                }
            });
        } else if (res.selection === 1) {
            const userWaypoints = [];
            const names = [];
            for (const [key, loc] of waypoints.entries()) {
                if (key.startsWith(player.name)) {
                    userWaypoints.push(loc);
                    names.push(key.replace(`${player.name}_`, ""));
                }
            }
            if (userWaypoints.length === 0) {
                player.sendMessage("§c[Junie Client] §fNo saved waypoints found!");
                return;
            }
            const tpForm = new ActionFormData().title("Select Waypoint to TP");
            for (const n of names) tpForm.button(`§l§9${n}`);
            tpForm.show(player).then((tpRes) => {
                if (tpRes.canceled) return;
                const targetLoc = userWaypoints[tpRes.selection];
                player.teleport(targetLoc);
                player.sendMessage(`§9[Junie Client] §fTeleported to waypoint!`);
            });
        }
    });
}

function openWorldMenu(player) {
    const form = new ActionFormData()
        .title("§l§bTime & Weather Control")
        .button("§l§9Set Time: Day")
        .button("§l§9Set Time: Night")
        .button("§l§9Clear Weather")
        .button("§l§9Set Weather: Rain/Thunder")
        .button("§l§9Back");

    form.show(player).then((res) => {
        if (res.canceled || res.selection === 4) { openMainMenu(player); return; }
        if (res.selection === 0) world.setTime(1000);
        if (res.selection === 1) world.setTime(13000);
        if (res.selection === 2) {
            try { player.dimension.runCommandAsync("weather clear"); } catch (e) {}
        }
        if (res.selection === 3) {
            try { player.dimension.runCommandAsync("weather thunder"); } catch (e) {}
        }
        player.sendMessage("§9[Junie Client] §fWorld environment updated!");
    });
}

function openParticleMenu(player) {
    const form = new ActionFormData()
        .title("§l§dParticle Trails & Auras")
        .body("Choose your active custom trail particle:");

    for (const p of particleOptions) {
        form.button(p.name);
    }
    form.button("§l§cDisable Particle Trail");
    form.button("§l§9Back");

    form.show(player).then((res) => {
        if (res.canceled || res.selection === particleOptions.length + 1) { openMainMenu(player); return; }
        if (res.selection === particleOptions.length) {
            activeParticleTrail.delete(player.name);
            player.sendMessage("§c[Junie Client] §fParticle trail disabled.");
        } else {
            const chosen = particleOptions[res.selection];
            activeParticleTrail.set(player.name, chosen);
            player.sendMessage(`§9[Junie Client] §fEquipped §e${chosen.name.replace(/§[0-9a-fk-or]/g, '')} §ftrail!`);
        }
    });
}

function openRadarMenu(player) {
    const form = new ActionFormData()
        .title("§l§bEntity Radar")
        .button(radarActive.has(player.name) ? "§l§cDisable Radar" : "§l§aEnable Radar")
        .button("§l§9Back");

    form.show(player).then((res) => {
        if (res.canceled || res.selection === 1) { openMainMenu(player); return; }
        if (res.selection === 0) {
            if (radarActive.has(player.name)) {
                radarActive.delete(player.name);
                player.sendMessage("§c[Junie Client] §fEntity Radar disabled.");
            } else {
                radarActive.add(player.name);
                player.sendMessage("§a[Junie Client] §fEntity Radar enabled.");
            }
        }
    });
}
import {
    LEGENDARY_ITEM_PRICE_LABEL as CATALOG_LEGENDARY_ITEM_PRICE_LABEL,
    getLegendaryPurchaseEntity,
    getLegendaryPurchaseEntityByProductId,
    getLegendaryPurchaseEntities,
    validateLegendaryPurchaseCatalog
} from './LegendaryPurchaseCatalog.js';

export const SKIN_STORAGE_KEY = 'chiggas_cosmetics_v5';

export const SKINS = {
    equipped_player_preview: {
        id: "equipped_player_preview",
        name: "Day One Chigga",
        description: "A Common starter cosmetic available from the beginning of the takeover.",
        assetKey: "skin-day-one-chigga",
        imagePath: "assets/day_one_chigga.png",
        type: "player",
        rarity: "common",
        unlockType: "free",
        productId: null,
        isPreviewSlot: false,
    },
    skin_beanie_biter_chigga: {
        id: "skin_beanie_biter_chigga",
        name: "Beanie Biter Chigga",
        description: "A Common starter cosmetic available from the beginning of the takeover.",
        assetKey: "skin-beanie-biter-chigga",
        imagePath: "assets/beanie_biter_chigga.png",
        type: "player",
        rarity: "common",
        unlockType: "free",
        productId: null,
    },
    skin_demin_mite_drip: {
        id: "skin_demin_mite_drip",
        name: "Denim Mite Drip",
        description: "A Common starter cosmetic available from the beginning of the takeover.",
        assetKey: "skin-demin-mite-drip",
        imagePath: "assets/demin_mite_drip.png",
        type: "player",
        rarity: "common",
        unlockType: "free",
        productId: null,
    },
    skin_puffer_parasite_chigga: {
        id: "skin_puffer_parasite_chigga",
        name: "Puffer Parasite Chigga",
        description: "A Common starter cosmetic available from the beginning of the takeover.",
        assetKey: "skin-puffer-parasite-chigga",
        imagePath: "assets/puffer_parasite_chigga.png",
        type: "player",
        rarity: "common",
        unlockType: "free",
        productId: null,
    },
    skin_camo_crawler_chigga: {
        id: "skin_camo_crawler_chigga",
        name: "Camo Crawler Chigga",
        description: "A Rare unlockable look earned through stage progress and steady turf control.",
        assetKey: "skin-camo-crawler-chigga",
        imagePath: "assets/camo_crawler_chigga.png",
        type: "player",
        rarity: "rare",
        unlockType: "stage_clear",
        unlockStage: 1,
        productId: null,
    },
    skin_red_puff_mite: {
        id: "skin_red_puff_mite",
        name: "Red Puff Mite",
        description: "A Rare unlockable look earned through stage progress and steady turf control.",
        assetKey: "skin-red-puff-mite",
        imagePath: "assets/red_puff_mite.png",
        type: "player",
        rarity: "rare",
        unlockType: "stage_clear",
        unlockStage: 2,
        productId: null,
    },
    skin_turf_sergeant_chigga: {
        id: "skin_turf_sergeant_chigga",
        name: "Turf Sergeant Chigga",
        description: "A Rare unlockable look earned through stage progress and steady turf control.",
        assetKey: "skin-turf-sergeant-chigga",
        imagePath: "assets/turf_sergeant_chigga.png",
        type: "player",
        rarity: "rare",
        unlockType: "stage_clear",
        unlockStage: 3,
        productId: null,
    },
    skin_yellow_jacket_itch: {
        id: "skin_yellow_jacket_itch",
        name: "Yellow Jacket Itch",
        description: "A Rare unlockable look earned through stage progress and steady turf control.",
        assetKey: "skin-yellow-jacket-itch",
        imagePath: "assets/yellow_jacket_itch.png",
        type: "player",
        rarity: "rare",
        unlockType: "stage_clear",
        unlockStage: 4,
        productId: null,
    },
    skin_bandana_bacilius: {
        id: "skin_bandana_bacilius",
        name: "Bandana Bacilius",
        description: "An Epic streetwear look with bold attitude, sharp details, and serious takeover energy.",
        assetKey: "skin-bandana-bacilius",
        imagePath: "assets/bandana_bacilius.png",
        type: "player",
        rarity: "epic",
        unlockType: "achievement",
        achievementId: "recruit_100",
        productId: null,
    },
    skin_capillary_capo: {
        id: "skin_capillary_capo",
        name: "Capillary Capo",
        description: "An Epic streetwear look with bold attitude, sharp details, and serious takeover energy.",
        assetKey: "skin-capillary-capo",
        imagePath: "assets/capillary_capo.png",
        type: "player",
        rarity: "epic",
        unlockType: "achievement",
        achievementId: "capture_50_turfs",
        productId: null,
    },
    skin_chain_reaction_chigga: {
        id: "skin_chain_reaction_chigga",
        name: "Chain Reaction Chigga",
        description: "An Epic streetwear look with bold attitude, sharp details, and serious takeover energy.",
        assetKey: "skin-chain-reaction-chigga",
        imagePath: "assets/chain_reaction_chigga.png",
        type: "player",
        rarity: "epic",
        unlockType: "achievement",
        achievementId: "boss_slayer",
        productId: null,
    },
    skin_denim_chain_mite: {
        id: "skin_denim_chain_mite",
        name: "Denim Chain Mite",
        description: "An Epic streetwear look with bold attitude, sharp details, and serious takeover energy.",
        assetKey: "skin-denim-chain-mite",
        imagePath: "assets/denim_chain_mite.png",
        type: "player",
        rarity: "epic",
        unlockType: "achievement",
        achievementId: "beat_basic",
        productId: null,
    },
    skin_hoodie_hookworm: {
        id: "skin_hoodie_hookworm",
        name: "Hoodie Hookworm",
        description: "An Epic streetwear look with bold attitude, sharp details, and serious takeover energy.",
        assetKey: "skin-hoodie-hookworm",
        imagePath: "assets/hoodie_hookworm.png",
        type: "player",
        rarity: "epic",
        unlockType: "achievement",
        achievementId: "beat_hard",
        productId: null,
    },
    skin_leather_louse_legend: {
        id: "skin_leather_louse_legend",
        name: "Leather Louse Legend",
        description: "An Epic streetwear look with bold attitude, sharp details, and serious takeover energy.",
        assetKey: "skin-leather-louse-legend",
        imagePath: "assets/leather_louse_legend.png",
        type: "player",
        rarity: "epic",
        unlockType: "achievement",
        achievementId: "kill_500",
        productId: null,
    },
    skin_neon_nit_drip: {
        id: "skin_neon_nit_drip",
        name: "Neon Nit Drip",
        description: "An Epic streetwear look with bold attitude, sharp details, and serious takeover energy.",
        assetKey: "skin-neon-nit-drip",
        imagePath: "assets/neon_nit_drip.png",
        type: "player",
        rarity: "epic",
        unlockType: "achievement",
        achievementId: "recruit_100",
        productId: null,
    },
    skin_street_scabies_chigga: {
        id: "skin_street_scabies_chigga",
        name: "Street Scabies Chigga",
        description: "An Epic streetwear look with bold attitude, sharp details, and serious takeover energy.",
        assetKey: "skin-street-scabies-chigga",
        imagePath: "assets/street_scabies_chigga.png",
        type: "player",
        rarity: "epic",
        unlockType: "achievement",
        achievementId: "capture_50_turfs",
        productId: null,
    },
    skin_velour_vector_chigga: {
        id: "skin_velour_vector_chigga",
        name: "Velour Vector Chigga",
        description: "An Epic streetwear look with bold attitude, sharp details, and serious takeover energy.",
        assetKey: "skin-velour-vector-chigga",
        imagePath: "assets/velour_vector_chigga.png",
        type: "player",
        rarity: "epic",
        unlockType: "achievement",
        achievementId: "boss_slayer",
        productId: null,
    },
    skin_white_chain_wriggler: {
        id: "skin_white_chain_wriggler",
        name: "White Chain Wriggler",
        description: "An Epic streetwear look with bold attitude, sharp details, and serious takeover energy.",
        assetKey: "skin-white-chain-wriggler",
        imagePath: "assets/white_chain_wriggler.png",
        type: "player",
        rarity: "epic",
        unlockType: "achievement",
        achievementId: "beat_basic",
        productId: null,
    },
    skin_chigga_bball_team_black: {
        id: "skin_chigga_bball_team_black",
        name: "Chigga B-Ball Team Black",
        description: "A Legendary court-ready uniform made for running the whole skin league.",
        assetKey: "skin-chigga-bball-team-black",
        imagePath: "assets/chigga_bball_team_black.png",
        type: "player",
        rarity: "legendary",
        unlockType: "premium",
        productId: "chigga_wear_skin_chigga_bball_team_black",
    },
    skin_chigga_bball_team_blue: {
        id: "skin_chigga_bball_team_blue",
        name: "Chigga B-Ball Team Blue",
        description: "A Legendary court-ready uniform made for running the whole skin league.",
        assetKey: "skin-chigga-bball-team-blue",
        imagePath: "assets/chigga_bball_team_blue.png",
        type: "player",
        rarity: "legendary",
        unlockType: "premium",
        productId: "chigga_wear_skin_chigga_bball_team_blue",
    },
    skin_chigga_bball_team_green: {
        id: "skin_chigga_bball_team_green",
        name: "Chigga B-Ball Team Green",
        description: "A Legendary court-ready uniform made for running the whole skin league.",
        assetKey: "skin-chigga-bball-team-green",
        imagePath: "assets/chigga_bball_team_green.png",
        type: "player",
        rarity: "legendary",
        unlockType: "premium",
        productId: "chigga_wear_skin_chigga_bball_team_green",
    },
    skin_chigga_bball_team_purple: {
        id: "skin_chigga_bball_team_purple",
        name: "Chigga B-Ball Team Purple",
        description: "A Legendary court-ready uniform made for running the whole skin league.",
        assetKey: "skin-chigga-bball-team-purple",
        imagePath: "assets/chigga_bball_team_purple.png",
        type: "player",
        rarity: "legendary",
        unlockType: "premium",
        productId: "chigga_wear_skin_chigga_bball_team_purple",
    },
    skin_chigga_bball_team_red: {
        id: "skin_chigga_bball_team_red",
        name: "Chigga B-Ball Team Red",
        description: "A Legendary court-ready uniform made for running the whole skin league.",
        assetKey: "skin-chigga-bball-team-red",
        imagePath: "assets/chigga_bball_team_red.png",
        type: "player",
        rarity: "legendary",
        unlockType: "premium",
        productId: "chigga_wear_skin_chigga_bball_team_red",
    },
    skin_chigga_fball_team_black: {
        id: "skin_chigga_fball_team_black",
        name: "Chigga F-Ball Team Black",
        description: "A Legendary gridiron fit with heavy team energy and turf-war attitude.",
        assetKey: "skin-chigga-fball-team-black",
        imagePath: "assets/chigga_fball_team_black.png",
        type: "player",
        rarity: "legendary",
        unlockType: "premium",
        productId: "chigga_wear_skin_chigga_fball_team_black",
    },
    skin_chigga_fball_team_green: {
        id: "skin_chigga_fball_team_green",
        name: "Chigga F-Ball Team Green",
        description: "A Legendary gridiron fit with heavy team energy and turf-war attitude.",
        assetKey: "skin-chigga-fball-team-green",
        imagePath: "assets/chigga_fball_team_green.png",
        type: "player",
        rarity: "legendary",
        unlockType: "premium",
        productId: "chigga_wear_skin_chigga_fball_team_green",
    },
    skin_chigga_fball_team_purple: {
        id: "skin_chigga_fball_team_purple",
        name: "Chigga F-Ball Team Purple",
        description: "A Legendary gridiron fit with heavy team energy and turf-war attitude.",
        assetKey: "skin-chigga-fball-team-purple",
        imagePath: "assets/chigga_fball_team_purple.png",
        type: "player",
        rarity: "legendary",
        unlockType: "premium",
        productId: "chigga_wear_skin_chigga_fball_team_purple",
    },
    skin_chigga_fball_team_red: {
        id: "skin_chigga_fball_team_red",
        name: "Chigga F-Ball Team Red",
        description: "A Legendary gridiron fit with heavy team energy and turf-war attitude.",
        assetKey: "skin-chigga-fball-team-red",
        imagePath: "assets/chigga_fball_team_red.png",
        type: "player",
        rarity: "legendary",
        unlockType: "premium",
        productId: "chigga_wear_skin_chigga_fball_team_red",
    },
    skin_chigga_vamp: {
        id: "skin_chigga_vamp",
        name: "Chigga Vamp",
        description: "A premium night-stalker look with supernatural bite and Legendary drip.",
        assetKey: "skin-chigga-vamp",
        imagePath: "assets/chigga_vamp.png",
        type: "player",
        rarity: "legendary",
        unlockType: "premium",
        productId: "chigga_wear_skin_chigga_vamp",
    },
    skin_formal_fine_flea: {
        id: "skin_formal_fine_flea",
        name: "Formal Fine Flea",
        description: "A premium formal fit with spy-level polish and boss-room confidence.",
        assetKey: "skin-formal-fine-flea",
        imagePath: "assets/formal_fine_flea.png",
        type: "player",
        rarity: "legendary",
        unlockType: "premium",
        productId: "chigga_wear_skin_formal_fine_flea",
    },
    skin_mummified_mite: {
        id: "skin_mummified_mite",
        name: "Mummified Mite",
        description: "A wrapped-up Legendary fit built for ancient mite mayhem.",
        assetKey: "skin-mummified-mite",
        imagePath: "assets/mummified_mite.png",
        type: "player",
        rarity: "legendary",
        unlockType: "premium",
        productId: "chigga_wear_skin_mummified_mite",
    },
    skin_pinstripe_plague_boss: {
        id: "skin_pinstripe_plague_boss",
        name: "Pinstripe Plague Boss",
        description: "A premium Legendary cosmetic built for players who want maximum swarm style.",
        assetKey: "skin-pinstripe-plague-boss",
        imagePath: "assets/pinstripe_plague_boss.png",
        type: "player",
        rarity: "legendary",
        unlockType: "premium",
        productId: "chigga_wear_skin_pinstripe_plague_boss",
    },
    skin_purple_velour_vandal: {
        id: "skin_purple_velour_vandal",
        name: "Purple Velour Vandal",
        description: "A premium Legendary cosmetic built for players who want maximum swarm style.",
        assetKey: "skin-purple-velour-vandal",
        imagePath: "assets/purple_velour_vandal.png",
        type: "player",
        rarity: "legendary",
        unlockType: "premium",
        productId: "chigga_wear_skin_purple_velour_vandal",
    },
    soldier_soldier_black_puffy_brown: {
        id: "soldier_soldier_black_puffy_brown",
        name: "Soldier Black Puffy Brown",
        description: "A Common starter cosmetic available from the beginning of the takeover.",
        assetKey: "soldier-soldier-black-puffy-brown",
        imagePath: "assets/soldier_black_puffy_brown.png",
        type: "soldier",
        rarity: "common",
        unlockType: "free",
        productId: null,
    },
    soldier_soldier_denim_green: {
        id: "soldier_soldier_denim_green",
        name: "Soldier Denim Green",
        description: "A Common starter cosmetic available from the beginning of the takeover.",
        assetKey: "soldier-soldier-denim-green",
        imagePath: "assets/soldier_denim_green.png",
        type: "soldier",
        rarity: "common",
        unlockType: "free",
        productId: null,
    },
    soldier_soldier_denim_red: {
        id: "soldier_soldier_denim_red",
        name: "Soldier Denim Red",
        description: "A Common starter cosmetic available from the beginning of the takeover.",
        assetKey: "soldier-soldier-denim-red",
        imagePath: "assets/soldier_denim_red.png",
        type: "soldier",
        rarity: "common",
        unlockType: "free",
        productId: null,
    },
    soldier_soldier_brown_leather_blue: {
        id: "soldier_soldier_brown_leather_blue",
        name: "Soldier Brown Leather Blue",
        description: "A Rare unlockable look earned through stage progress and steady turf control.",
        assetKey: "soldier-soldier-brown-leather-blue",
        imagePath: "assets/soldier_brown_leather_blue.png",
        type: "soldier",
        rarity: "rare",
        unlockType: "stage_clear",
        unlockStage: 1,
        productId: null,
    },
    soldier_soldier_denim_camo_cap: {
        id: "soldier_soldier_denim_camo_cap",
        name: "Soldier Denim Camo Cap",
        description: "A Rare unlockable look earned through stage progress and steady turf control.",
        assetKey: "soldier-soldier-denim-camo-cap",
        imagePath: "assets/soldier_denim_camo_cap.png",
        type: "soldier",
        rarity: "rare",
        unlockType: "stage_clear",
        unlockStage: 2,
        productId: null,
    },
    soldier_soldier_denim_camoflage: {
        id: "soldier_soldier_denim_camoflage",
        name: "Soldier Denim Camoflage",
        description: "A Rare unlockable look earned through stage progress and steady turf control.",
        assetKey: "soldier-soldier-denim-camoflage",
        imagePath: "assets/soldier_denim_camoflage.png",
        type: "soldier",
        rarity: "rare",
        unlockType: "stage_clear",
        unlockStage: 3,
        productId: null,
    },
    soldier_soldier_denim_white_scully: {
        id: "soldier_soldier_denim_white_scully",
        name: "Soldier Denim White Scully",
        description: "A Rare unlockable look earned through stage progress and steady turf control.",
        assetKey: "soldier-soldier-denim-white-scully",
        imagePath: "assets/soldier_denim_white_scully.png",
        type: "soldier",
        rarity: "rare",
        unlockType: "stage_clear",
        unlockStage: 4,
        productId: null,
    },
    soldier_soldier_leather_brown: {
        id: "soldier_soldier_leather_brown",
        name: "Soldier Leather Brown",
        description: "A Rare unlockable look earned through stage progress and steady turf control.",
        assetKey: "soldier-soldier-leather-brown",
        imagePath: "assets/soldier_leather_brown.png",
        type: "soldier",
        rarity: "rare",
        unlockType: "stage_clear",
        unlockStage: 5,
        productId: null,
    },
    soldier_soldier_blue_vest_glasses: {
        id: "soldier_soldier_blue_vest_glasses",
        name: "Soldier Blue Vest Glasses",
        description: "An Epic streetwear look with bold attitude, sharp details, and serious takeover energy.",
        assetKey: "soldier-soldier-blue-vest-glasses",
        imagePath: "assets/soldier_blue_vest_glasses.png",
        type: "soldier",
        rarity: "epic",
        unlockType: "achievement",
        achievementId: "recruit_100",
        productId: null,
    },
    soldier_soldier_denim_durag: {
        id: "soldier_soldier_denim_durag",
        name: "Soldier Denim Durag",
        description: "An Epic streetwear look with bold attitude, sharp details, and serious takeover energy.",
        assetKey: "soldier-soldier-denim-durag",
        imagePath: "assets/soldier_denim_durag.png",
        type: "soldier",
        rarity: "epic",
        unlockType: "achievement",
        achievementId: "capture_50_turfs",
        productId: null,
    },
    soldier_soldier_denim_leather_hat: {
        id: "soldier_soldier_denim_leather_hat",
        name: "Soldier Denim Leather Hat",
        description: "An Epic streetwear look with bold attitude, sharp details, and serious takeover energy.",
        assetKey: "soldier-soldier-denim-leather-hat",
        imagePath: "assets/soldier_denim_leather_hat.png",
        type: "soldier",
        rarity: "epic",
        unlockType: "achievement",
        achievementId: "boss_slayer",
        productId: null,
    },
    soldier_soldier_denim_purple: {
        id: "soldier_soldier_denim_purple",
        name: "Soldier Denim Purple",
        description: "An Epic streetwear look with bold attitude, sharp details, and serious takeover energy.",
        assetKey: "soldier-soldier-denim-purple",
        imagePath: "assets/soldier_denim_purple.png",
        type: "soldier",
        rarity: "epic",
        unlockType: "achievement",
        achievementId: "beat_basic",
        productId: null,
    },
    soldier_soldier_smart_scully: {
        id: "soldier_soldier_smart_scully",
        name: "Soldier Smart Scully",
        description: "An Epic streetwear look with bold attitude, sharp details, and serious takeover energy.",
        assetKey: "soldier-soldier-smart-scully",
        imagePath: "assets/soldier_smart_scully.png",
        type: "soldier",
        rarity: "epic",
        unlockType: "achievement",
        achievementId: "beat_hard",
        productId: null,
    },
    soldier_lil_vamp_soldier: {
        id: "soldier_lil_vamp_soldier",
        name: "Lil Vamp Soldier",
        description: "A premium night-stalker look with supernatural bite and Legendary drip.",
        assetKey: "soldier-lil-vamp-soldier",
        imagePath: "assets/lil_vamp_soldier.png",
        type: "soldier",
        rarity: "legendary",
        unlockType: "premium",
        productId: "chigga_wear_soldier_lil_vamp_soldier",
    },
    soldier_soldier_0007_suit: {
        id: "soldier_soldier_0007_suit",
        name: "Soldier 0007 Suit",
        description: "A premium formal fit with spy-level polish and boss-room confidence.",
        assetKey: "soldier-soldier-0007-suit",
        imagePath: "assets/soldier_0007_suit.png",
        type: "soldier",
        rarity: "legendary",
        unlockType: "premium",
        productId: "chigga_wear_soldier_soldier_0007_suit",
    },
    soldier_soldier_bball_blue: {
        id: "soldier_soldier_bball_blue",
        name: "Soldier B-Ball Blue",
        description: "A Legendary court-ready uniform made for running the whole skin league.",
        assetKey: "soldier-soldier-bball-blue",
        imagePath: "assets/soldier_bball_blue.png",
        type: "soldier",
        rarity: "legendary",
        unlockType: "premium",
        productId: "chigga_wear_soldier_soldier_bball_blue",
    },
    soldier_soldier_bball_team_flame: {
        id: "soldier_soldier_bball_team_flame",
        name: "Soldier B-Ball Team Flame",
        description: "A Legendary court-ready uniform made for running the whole skin league.",
        assetKey: "soldier-soldier-bball-team-flame",
        imagePath: "assets/soldier_bball_team_flame.png",
        type: "soldier",
        rarity: "legendary",
        unlockType: "premium",
        productId: "chigga_wear_soldier_soldier_bball_team_flame",
    },
    soldier_soldier_bball_team_green: {
        id: "soldier_soldier_bball_team_green",
        name: "Soldier B-Ball Team Green",
        description: "A Legendary court-ready uniform made for running the whole skin league.",
        assetKey: "soldier-soldier-bball-team-green",
        imagePath: "assets/soldier_bball_team_green.png",
        type: "soldier",
        rarity: "legendary",
        unlockType: "premium",
        productId: "chigga_wear_soldier_soldier_bball_team_green",
    },
    soldier_soldier_bball_team_purple: {
        id: "soldier_soldier_bball_team_purple",
        name: "Soldier B-Ball Team Purple",
        description: "A Legendary court-ready uniform made for running the whole skin league.",
        assetKey: "soldier-soldier-bball-team-purple",
        imagePath: "assets/soldier_bball_team_purple.png",
        type: "soldier",
        rarity: "legendary",
        unlockType: "premium",
        productId: "chigga_wear_soldier_soldier_bball_team_purple",
    },
    soldier_soldier_bball_team_red: {
        id: "soldier_soldier_bball_team_red",
        name: "Soldier B-Ball Team Red",
        description: "A Legendary court-ready uniform made for running the whole skin league.",
        assetKey: "soldier-soldier-bball-team-red",
        imagePath: "assets/soldier_bball_team_red.png",
        type: "soldier",
        rarity: "legendary",
        unlockType: "premium",
        productId: "chigga_wear_soldier_soldier_bball_team_red",
    },
    soldier_soldier_franken_flea: {
        id: "soldier_soldier_franken_flea",
        name: "Soldier Franken Flea",
        description: "A stitched-up Legendary soldier look with monster-movie bite.",
        assetKey: "soldier-soldier-franken-flea",
        imagePath: "assets/soldier_franken_flea.png",
        type: "soldier",
        rarity: "legendary",
        unlockType: "premium",
        productId: "chigga_wear_soldier_soldier_franken_flea",
    },
    soldier_soldier_mummy_fit: {
        id: "soldier_soldier_mummy_fit",
        name: "Soldier Mummy Fit",
        description: "A wrapped-up Legendary fit built for ancient mite mayhem.",
        assetKey: "soldier-soldier-mummy-fit",
        imagePath: "assets/soldier_mummy_fit.png",
        type: "soldier",
        rarity: "legendary",
        unlockType: "premium",
        productId: "chigga_wear_soldier_soldier_mummy_fit",
    },
    soldier_soldier_sour_prince: {
        id: "soldier_soldier_sour_prince",
        name: "Soldier Sour Prince",
        description: "A premium Legendary cosmetic built for players who want maximum swarm style.",
        assetKey: "soldier-soldier-sour-prince",
        imagePath: "assets/soldier_sour_prince.png",
        type: "soldier",
        rarity: "legendary",
        unlockType: "premium",
        productId: "chigga_wear_soldier_soldier_sour_prince",
    },
    soldier_soldier_team_black: {
        id: "soldier_soldier_team_black",
        name: "Soldier Team Black",
        description: "A premium Legendary cosmetic built for players who want maximum swarm style.",
        assetKey: "soldier-soldier-team-black",
        imagePath: "assets/soldier_team_black.png",
        type: "soldier",
        rarity: "legendary",
        unlockType: "premium",
        productId: "chigga_wear_soldier_soldier_team_black",
    },
    soldier_soldier_team_black_2: {
        id: "soldier_soldier_team_black_2",
        name: "Soldier Team Black 2",
        description: "A premium Legendary cosmetic built for players who want maximum swarm style.",
        assetKey: "soldier-soldier-team-black-2",
        imagePath: "assets/soldier_team_black_2.png",
        type: "soldier",
        rarity: "legendary",
        unlockType: "premium",
        productId: "chigga_wear_soldier_soldier_team_black_2",
    },
    soldier_soldier_team_blue: {
        id: "soldier_soldier_team_blue",
        name: "Soldier Team Blue",
        description: "A premium Legendary cosmetic built for players who want maximum swarm style.",
        assetKey: "soldier-soldier-team-blue",
        imagePath: "assets/soldier_team_blue.png",
        type: "soldier",
        rarity: "legendary",
        unlockType: "premium",
        productId: "chigga_wear_soldier_soldier_team_blue",
    },
    soldier_soldier_team_green: {
        id: "soldier_soldier_team_green",
        name: "Soldier Team Green",
        description: "A premium Legendary cosmetic built for players who want maximum swarm style.",
        assetKey: "soldier-soldier-team-green",
        imagePath: "assets/soldier_team_green.png",
        type: "soldier",
        rarity: "legendary",
        unlockType: "premium",
        productId: "chigga_wear_soldier_soldier_team_green",
    },
    soldier_soldier_team_orange: {
        id: "soldier_soldier_team_orange",
        name: "Soldier Team Orange",
        description: "A premium Legendary cosmetic built for players who want maximum swarm style.",
        assetKey: "soldier-soldier-team-orange",
        imagePath: "assets/soldier_team_orange.png",
        type: "soldier",
        rarity: "legendary",
        unlockType: "premium",
        productId: "chigga_wear_soldier_soldier_team_orange",
    },
    soldier_soldier_team_yellow: {
        id: "soldier_soldier_team_yellow",
        name: "Soldier Team Yellow",
        description: "A premium Legendary cosmetic built for players who want maximum swarm style.",
        assetKey: "soldier-soldier-team-yellow",
        imagePath: "assets/soldier_team_yellow.png",
        type: "soldier",
        rarity: "legendary",
        unlockType: "premium",
        productId: "chigga_wear_soldier_soldier_team_yellow",
    }
};

export const SKIN_ORDER = [
    "equipped_player_preview",
    "skin_beanie_biter_chigga",
    "skin_demin_mite_drip",
    "skin_puffer_parasite_chigga",
    "skin_camo_crawler_chigga",
    "skin_red_puff_mite",
    "skin_turf_sergeant_chigga",
    "skin_yellow_jacket_itch",
    "skin_bandana_bacilius",
    "skin_capillary_capo",
    "skin_chain_reaction_chigga",
    "skin_denim_chain_mite",
    "skin_hoodie_hookworm",
    "skin_leather_louse_legend",
    "skin_neon_nit_drip",
    "skin_street_scabies_chigga",
    "skin_velour_vector_chigga",
    "skin_white_chain_wriggler",
    "skin_chigga_bball_team_black",
    "skin_chigga_bball_team_blue",
    "skin_chigga_bball_team_green",
    "skin_chigga_bball_team_purple",
    "skin_chigga_bball_team_red",
    "skin_chigga_fball_team_black",
    "skin_chigga_fball_team_green",
    "skin_chigga_fball_team_purple",
    "skin_chigga_fball_team_red",
    "skin_chigga_vamp",
    "skin_formal_fine_flea",
    "skin_mummified_mite",
    "skin_pinstripe_plague_boss",
    "skin_purple_velour_vandal",
    "soldier_soldier_black_puffy_brown",
    "soldier_soldier_denim_green",
    "soldier_soldier_denim_red",
    "soldier_soldier_brown_leather_blue",
    "soldier_soldier_denim_camo_cap",
    "soldier_soldier_denim_camoflage",
    "soldier_soldier_denim_white_scully",
    "soldier_soldier_leather_brown",
    "soldier_soldier_blue_vest_glasses",
    "soldier_soldier_denim_durag",
    "soldier_soldier_denim_leather_hat",
    "soldier_soldier_denim_purple",
    "soldier_soldier_smart_scully",
    "soldier_lil_vamp_soldier",
    "soldier_soldier_0007_suit",
    "soldier_soldier_bball_blue",
    "soldier_soldier_bball_team_flame",
    "soldier_soldier_bball_team_green",
    "soldier_soldier_bball_team_purple",
    "soldier_soldier_bball_team_red",
    "soldier_soldier_franken_flea",
    "soldier_soldier_mummy_fit",
    "soldier_soldier_sour_prince",
    "soldier_soldier_team_black",
    "soldier_soldier_team_black_2",
    "soldier_soldier_team_blue",
    "soldier_soldier_team_green",
    "soldier_soldier_team_orange",
    "soldier_soldier_team_yellow",
];

export function getAllSkins() {
    return SKIN_ORDER.map(id => SKINS[id]).filter(Boolean);
}

export function getSkinsByType(type) {
    return getAllSkins().filter(skin => skin.type === type);
}

export function getSkin(id) {
    return SKINS[id] || SKINS.equipped_player_preview;
}

export const ACHIEVEMENT_REQUIREMENTS = {
    recruit_100: 'Recruit 100 Chiggas in one run',
    capture_50_turfs: 'Claim 50 turfs across a run',
    boss_slayer: 'Defeat all bosses in one run',
    beat_basic: 'Beat the game on Straight Up Basic or harder',
    beat_hard: "Beat the game on You Gotta Be Kiddin' Me",
    kill_500: 'Defeat 500 hostile enemies in one run'
};

export function getFreeSkinIds() {
    return SKIN_ORDER.filter(id => SKINS[id]?.unlockType === 'free');
}

function normalizeUnlockedSkins(unlockedSkins = []) {
    const safe = Array.isArray(unlockedSkins) ? unlockedSkins.filter(id => !!SKINS[id]) : [];
    const merged = new Set([...getFreeSkinIds(), ...safe]);
    return Array.from(merged);
}

export function loadCosmeticState() {
    try {
        const raw = window.localStorage.getItem(SKIN_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return {
            selectedPlayerSkin: parsed.selectedPlayerSkin || 'equipped_player_preview',
            selectedSoldierSkin: parsed.selectedSoldierSkin || 'soldier_soldier_denim_red',
            unlockedSkins: normalizeUnlockedSkins(parsed.unlockedSkins),
            purchasedSkins: Array.isArray(parsed.purchasedSkins) ? parsed.purchasedSkins.filter(id => !!SKINS[id] && !!getLegendaryPurchaseEntity(id)) : [],
            completedStages: Array.isArray(parsed.completedStages) ? parsed.completedStages : [],
            unlockedAchievements: Array.isArray(parsed.unlockedAchievements) ? parsed.unlockedAchievements : []
        };
    } catch (e) {
        return {
            selectedPlayerSkin: 'equipped_player_preview',
            selectedSoldierSkin: 'soldier_soldier_denim_red',
            unlockedSkins: normalizeUnlockedSkins([]),
            purchasedSkins: [],
            completedStages: [],
            unlockedAchievements: []
        };
    }
}

export function saveCosmeticState(state) {
    try {
        const normalized = {
            ...state,
            unlockedSkins: normalizeUnlockedSkins(state?.unlockedSkins),
            purchasedSkins: Array.isArray(state?.purchasedSkins) ? state.purchasedSkins.filter(id => !!SKINS[id] && !!getLegendaryPurchaseEntity(id)) : []
        };
        window.localStorage.setItem(SKIN_STORAGE_KEY, JSON.stringify(normalized));
    } catch (e) {}
}

export function resetCosmeticState() {
    const resetState = {
        selectedPlayerSkin: 'equipped_player_preview',
        selectedSoldierSkin: 'soldier_soldier_denim_red',
        unlockedSkins: normalizeUnlockedSkins([]),
        purchasedSkins: [],
        completedStages: [],
        unlockedAchievements: []
    };

    try {
        window.localStorage.removeItem(SKIN_STORAGE_KEY);
        window.localStorage.removeItem('chiggas_cosmetics_v2');
        window.localStorage.removeItem('chiggas_cosmetics_v3');
        window.localStorage.removeItem('chiggas_cosmetics_v4');
    } catch (e) {}

    saveCosmeticState(resetState);
    return resetState;
}

export function isSkinUnlocked(id) {
    const skin = getSkin(id);
    if (!skin) return false;
    if (skin.unlockType === 'free') return true;

    const state = loadCosmeticState();

    // Legendary/Premium Chigga Wear is purchase-only.
    // Stage rewards, achievements, mini-games, and generic unlocks must not unlock premium skins.
    if (skin.unlockType === 'premium') {
        return state.purchasedSkins.includes(id);
    }

    return state.unlockedSkins.includes(id);
}

export function unlockSkin(id) {
    const skin = getSkin(id);
    if (!skin || skin.isPreviewSlot || skin.unlockType === 'premium') return null;

    const state = loadCosmeticState();
    if (!state.unlockedSkins.includes(id)) {
        state.unlockedSkins.push(id);
        saveCosmeticState(state);
        return skin;
    }

    return null;
}

export function unlockSkins(ids = []) {
    const newlyUnlocked = [];
    const state = loadCosmeticState();

    ids.forEach(id => {
        const skin = getSkin(id);
        if (!skin || skin.isPreviewSlot || skin.unlockType === 'premium') return;
        if (!state.unlockedSkins.includes(id)) {
            state.unlockedSkins.push(id);
            newlyUnlocked.push(skin);
        }
    });

    if (newlyUnlocked.length > 0) {
        saveCosmeticState(state);
    }

    return newlyUnlocked;
}

/* CHIGGAS_WEAR_UNLOCK_LOGIC_PASS_95A_BEGIN */
export const PASS95A_BASE_UNLOCK_REQUIREMENTS = {
    skin_camo_crawler_chigga: {
        text: 'Beat Stage 1 on any difficulty',
        kind: 'stage_clear',
        stage: 1
    },
    skin_red_puff_mite: {
        text: 'Unlock Stage 2 on Straight Up Basic',
        kind: 'stage_reached',
        stage: 2,
        minDifficulty: 1
    },
    skin_turf_sergeant_chigga: {
        text: 'Beat Stage 2 on Straight Up Basic',
        kind: 'stage_clear',
        stage: 2,
        minDifficulty: 1
    },
    skin_yellow_jacket_itch: {
        text: 'Beat Stage 3 on Straight Up Basic',
        kind: 'stage_clear',
        stage: 3,
        minDifficulty: 1
    },
    skin_bandana_bacilius: {
        text: 'Recruit 25 Soldiers in one run',
        kind: 'recruits',
        run: 25
    },
    skin_capillary_capo: {
        text: 'Claim 25 Turfs in one run',
        kind: 'turfs',
        run: 25
    },
    skin_chain_reaction_chigga: {
        text: 'Defeat your first Boss',
        kind: 'bosses',
        run: 1,
        total: 1
    },
    skin_denim_chain_mite: {
        text: 'Beat Stage 2 on Straight Up Basic',
        kind: 'stage_clear',
        stage: 2,
        minDifficulty: 1
    },
    skin_hoodie_hookworm: {
        text: "Beat Stage 3 on You Gotta Be Kiddin' Me",
        kind: 'stage_clear',
        stage: 3,
        minDifficulty: 2
    },
    skin_leather_louse_legend: {
        text: 'Defeat 500 enemies total',
        kind: 'kills',
        total: 500
    },
    skin_neon_nit_drip: {
        text: 'Recruit 100 Soldiers total',
        kind: 'recruits',
        total: 100
    },
    skin_street_scabies_chigga: {
        text: 'Claim 50 Turfs in one run',
        kind: 'turfs',
        run: 50,
        total: 100
    },
    skin_velour_vector_chigga: {
        text: 'Defeat 3 Bosses in one run',
        kind: 'bosses',
        run: 3,
        total: 5
    },
    skin_white_chain_wriggler: {
        text: 'Beat Stage 4 on Straight Up Basic',
        kind: 'stage_clear',
        stage: 4,
        minDifficulty: 1
    },
    soldier_soldier_brown_leather_blue: {
        text: 'Beat Stage 1 on any difficulty',
        kind: 'stage_clear',
        stage: 1
    },
    soldier_soldier_denim_camo_cap: {
        text: 'Unlock Stage 2 on Straight Up Basic',
        kind: 'stage_reached',
        stage: 2,
        minDifficulty: 1
    },
    soldier_soldier_denim_camoflage: {
        text: 'Beat Stage 2 on Straight Up Basic',
        kind: 'stage_clear',
        stage: 2,
        minDifficulty: 1
    },
    soldier_soldier_denim_white_scully: {
        text: 'Beat Stage 3 on Straight Up Basic',
        kind: 'stage_clear',
        stage: 3,
        minDifficulty: 1
    },
    soldier_soldier_leather_brown: {
        text: 'Beat Stage 4 on Straight Up Basic',
        kind: 'stage_clear',
        stage: 4,
        minDifficulty: 1
    },
    soldier_soldier_blue_vest_glasses: {
        text: 'Recruit 50 Soldiers total',
        kind: 'recruits',
        total: 50
    },
    soldier_soldier_denim_durag: {
        text: 'Claim 75 Turfs total',
        kind: 'turfs',
        total: 75
    },
    soldier_soldier_denim_leather_hat: {
        text: 'Defeat the final Boss',
        kind: 'final_clear',
        minDifficulty: 0
    },
    soldier_soldier_denim_purple: {
        text: 'Beat Stage 2 on Straight Up Basic',
        kind: 'stage_clear',
        stage: 2,
        minDifficulty: 1
    },
    soldier_soldier_smart_scully: {
        text: "Beat Stage 2 on You Gotta Be Kiddin' Me",
        kind: 'stage_clear',
        stage: 2,
        minDifficulty: 2
    }
};

export function pass95AGetBaseChiggaWearIds() {
    return SKIN_ORDER.filter(id => {
        const skin = SKINS[id];
        if (!skin || skin.isPreviewSlot) return false;
        if (skin.unlockType === 'premium' || skin.rarity === 'legendary') return false;
        return skin.type === 'player' || skin.type === 'soldier';
    });
}

function pass95AReadAllRecords() {
    try {
        if (typeof window === 'undefined' || !window.localStorage) return {};
        const raw = window.localStorage.getItem('chiggas_records_v1');
        return raw ? (JSON.parse(raw) || {}) : {};
    } catch (_) {
        return {};
    }
}

function pass95AGetRecord(records, key) {
    return records && records[key] ? records[key] : {};
}

function pass95ASum(records, field) {
    return ['difficulty_0', 'difficulty_1', 'difficulty_2']
        .map(key => Number(pass95AGetRecord(records, key)[field] || 0))
        .reduce((a, b) => a + b, 0);
}

function pass95AMax(records, field) {
    return Math.max(
        0,
        Number(pass95AGetRecord(records, 'difficulty_0')[field] || 0),
        Number(pass95AGetRecord(records, 'difficulty_1')[field] || 0),
        Number(pass95AGetRecord(records, 'difficulty_2')[field] || 0)
    );
}

function pass95AMaxForDifficulty(records, field, minDifficulty = 0) {
    let max = 0;
    for (let d = minDifficulty; d <= 2; d += 1) {
        max = Math.max(max, Number(pass95AGetRecord(records, `difficulty_${d}`)[field] || 0));
    }
    return max;
}

function pass95ASumForDifficulty(records, field, minDifficulty = 0) {
    let total = 0;
    for (let d = minDifficulty; d <= 2; d += 1) {
        total += Number(pass95AGetRecord(records, `difficulty_${d}`)[field] || 0);
    }
    return total;
}

function pass95ANormalizeProgress(progress = {}) {
    const records = progress.records || pass95AReadAllRecords();
    const runStats = progress.runStats || {};

    const activeDifficulty = Number.isFinite(Number(progress.difficulty)) ? Number(progress.difficulty) : null;
    const activeCompletedStage = Number(progress.completedStage || 0);
    const activeStageReached = Math.max(
        Number(progress.stageReached || 0),
        activeCompletedStage > 0 ? activeCompletedStage + 1 : 0,
        Number(runStats.stageReached || 0)
    );

    const completedStages = Array.isArray(progress.completedStages) ? progress.completedStages : [];

    const completedStageAny = Math.max(
        0,
        activeCompletedStage,
        ...completedStages.map(Number).filter(Number.isFinite),
        pass95AMax(records, 'bestStage') > 0 ? Math.max(0, pass95AMax(records, 'bestStage') - 1) : 0
    );

    const stageReachedAny = Math.max(
        0,
        activeStageReached,
        pass95AMax(records, 'bestStage')
    );

    const totals = {
        kills: Math.max(Number(runStats.kills || 0), pass95ASum(records, 'totalKills'), pass95AMax(records, 'bestKills')),
        recruits: Math.max(Number(runStats.recruits || 0), pass95ASum(records, 'totalRecruits'), pass95AMax(records, 'bestRecruits')),
        turfs: Math.max(Number(runStats.turfsClaimed || 0), pass95ASum(records, 'totalTurfsClaimed'), pass95AMax(records, 'bestTurfsClaimed')),
        bosses: Math.max(Number(runStats.bossesDefeated || 0), pass95ASum(records, 'totalBossesDefeated'))
    };

    const bestRun = {
        kills: Math.max(Number(runStats.kills || 0), pass95AMax(records, 'bestKills')),
        recruits: Math.max(Number(runStats.recruits || 0), pass95AMax(records, 'bestRecruits')),
        turfs: Math.max(Number(runStats.turfsClaimed || 0), pass95AMax(records, 'bestTurfsClaimed')),
        bosses: Math.max(Number(runStats.bossesDefeated || 0), pass95AMax(records, 'totalBossesDefeated'))
    };

    const bestStageByDifficulty = minDifficulty => Math.max(
        activeDifficulty !== null && activeDifficulty >= minDifficulty ? activeStageReached : 0,
        pass95AMaxForDifficulty(records, 'bestStage', minDifficulty)
    );

    const completedStageByDifficulty = minDifficulty => Math.max(
        activeDifficulty !== null && activeDifficulty >= minDifficulty ? activeCompletedStage : 0,
        pass95AMaxForDifficulty(records, 'bestStage', minDifficulty) > 0 ? pass95AMaxForDifficulty(records, 'bestStage', minDifficulty) - 1 : 0
    );

    const fullClearByDifficulty = minDifficulty => {
        const finalStageCount = Number(progress.finalStageCount || 5);
        const activeFullClear = !!progress.isFinalClear && (activeDifficulty === null || activeDifficulty >= minDifficulty);
        return activeFullClear ||
            bestStageByDifficulty(minDifficulty) >= finalStageCount ||
            pass95ASumForDifficulty(records, 'totalBossesDefeated', minDifficulty) >= finalStageCount;
    };

    return {
        ...progress,
        records,
        runStats,
        activeDifficulty,
        activeCompletedStage,
        activeStageReached,
        completedStageAny,
        stageReachedAny,
        totals,
        bestRun,
        bestStageByDifficulty,
        completedStageByDifficulty,
        fullClearByDifficulty
    };
}

function pass95ARequirementMet(requirement, progress) {
    if (!requirement) return false;

    const minDifficulty = Number(requirement.minDifficulty || 0);

    switch (requirement.kind) {
        case 'stage_clear':
            if (minDifficulty > 0) return progress.completedStageByDifficulty(minDifficulty) >= Number(requirement.stage || 0);
            return progress.completedStageAny >= Number(requirement.stage || 0);
        case 'stage_reached':
            if (minDifficulty > 0) return progress.bestStageByDifficulty(minDifficulty) >= Number(requirement.stage || 0);
            return progress.stageReachedAny >= Number(requirement.stage || 0);
        case 'kills':
            return progress.bestRun.kills >= Number(requirement.run || Infinity) ||
                progress.totals.kills >= Number(requirement.total || Infinity);
        case 'recruits':
            return progress.bestRun.recruits >= Number(requirement.run || Infinity) ||
                progress.totals.recruits >= Number(requirement.total || Infinity);
        case 'turfs':
            return progress.bestRun.turfs >= Number(requirement.run || Infinity) ||
                progress.totals.turfs >= Number(requirement.total || Infinity);
        case 'bosses':
            return progress.bestRun.bosses >= Number(requirement.run || Infinity) ||
                progress.totals.bosses >= Number(requirement.total || Infinity);
        case 'final_clear':
            return progress.fullClearByDifficulty(minDifficulty);
        default:
            return false;
    }
}

export function pass95AGetBaseUnlockCompletion(stateOverride = null) {
    const state = stateOverride || loadCosmeticState();
    const baseIds = pass95AGetBaseChiggaWearIds();
    const unlockedIds = baseIds.filter(id => {
        const skin = SKINS[id];
        if (!skin) return false;
        if (skin.unlockType === 'free') return true;
        return state.unlockedSkins.includes(id);
    });

    const lockedIds = baseIds.filter(id => !unlockedIds.includes(id));

    return {
        total: baseIds.length,
        unlocked: unlockedIds.length,
        locked: lockedIds.length,
        allUnlocked: lockedIds.length === 0,
        baseIds,
        unlockedIds,
        lockedIds
    };
}

export function pass95AUnlockBaseChiggaWear(progress = {}) {
    const normalizedProgress = pass95ANormalizeProgress(progress);
    const state = loadCosmeticState();
    let changed = false;

    state.pass95AProgress = {
        ...(state.pass95AProgress || {}),
        lastEvent: progress.event || 'catchup',
        lastCheckedAt: new Date().toISOString(),
        activeDifficulty: normalizedProgress.activeDifficulty,
        activeStageReached: normalizedProgress.activeStageReached,
        activeCompletedStage: normalizedProgress.activeCompletedStage,
        completedStageAny: normalizedProgress.completedStageAny,
        stageReachedAny: normalizedProgress.stageReachedAny,
        totals: normalizedProgress.totals,
        bestRun: normalizedProgress.bestRun
    };

    if (normalizedProgress.activeCompletedStage > 0 && !state.completedStages.includes(normalizedProgress.activeCompletedStage)) {
        state.completedStages.push(normalizedProgress.activeCompletedStage);
        changed = true;
    }

    const newlyUnlocked = [];

    pass95AGetBaseChiggaWearIds().forEach(id => {
        const skin = SKINS[id];
        if (!skin || skin.unlockType === 'free' || state.unlockedSkins.includes(id)) return;

        const requirement = PASS95A_BASE_UNLOCK_REQUIREMENTS[id];
        if (pass95ARequirementMet(requirement, normalizedProgress)) {
            state.unlockedSkins.push(id);
            newlyUnlocked.push(skin);
            changed = true;
        }
    });

    const completion = pass95AGetBaseUnlockCompletion(state);

    state.pass95ABaseCompletion = {
        total: completion.total,
        unlocked: completion.unlocked,
        locked: completion.locked,
        allUnlocked: completion.allUnlocked,
        lastCheckedAt: new Date().toISOString()
    };

    if (changed || newlyUnlocked.length || progress.forceSave) {
        saveCosmeticState(state);
    }

    try {
        if (typeof window !== 'undefined') {
            window.__chiggasPass95ABaseUnlockStatus = {
                pass: 'chigga_wear_unlock_logic_pass_95a',
                newlyUnlocked: newlyUnlocked.map(s => s.id),
                completion,
                progress: state.pass95AProgress,
                time: new Date().toISOString()
            };
        }
    } catch (_) {}

    return {
        newlyUnlocked,
        completion,
        progress: state.pass95AProgress
    };
}
/* CHIGGAS_WEAR_UNLOCK_LOGIC_PASS_95A_END */

export function unlockStageRewards(stageIndex) {
    const stageNumber = Number(stageIndex) + 1;
    const result = pass95AUnlockBaseChiggaWear({
        event: 'legacy_stage_clear',
        completedStage: stageNumber,
        stageReached: stageNumber + 1,
        forceSave: true
    });

    return result.newlyUnlocked || [];
}

export function unlockAchievementRewards(achievementId) {
    if (!achievementId) return [];

    const state = loadCosmeticState();
    if (!state.unlockedAchievements.includes(achievementId)) {
        state.unlockedAchievements.push(achievementId);
        saveCosmeticState(state);
    }

    const result = pass95AUnlockBaseChiggaWear({
        event: 'legacy_achievement',
        achievementId,
        forceSave: true
    });

    return result.newlyUnlocked || [];
}

export const LEGENDARY_ITEM_PRICE_LABEL = CATALOG_LEGENDARY_ITEM_PRICE_LABEL;

export function getLegendaryStoreItems(type = null) {
    return getLegendaryPurchaseEntities(type)
        .map(entity => {
            const skin = SKINS[entity.skinId];
            if (!skin || skin.unlockType !== 'premium' || skin.rarity !== 'legendary') return null;

            return {
                ...skin,
                productId: entity.productId,
                googlePlayProductId: entity.googlePlayProductId,
                steamProductId: entity.steamProductId,
                steamItemDefId: entity.steamItemDefId,
                priceUsd: entity.priceUsd,
                priceLabel: entity.priceLabel,
                purchaseEntity: entity
            };
        })
        .filter(Boolean);
}

export function getLegendaryPurchaseCatalog(type = null) {
    return getLegendaryPurchaseEntities(type);
}

export function getPurchaseEntityForSkin(id) {
    return getLegendaryPurchaseEntity(id);
}

export function getPurchaseEntityForProductId(productId) {
    return getLegendaryPurchaseEntityByProductId(productId);
}

export function validateLegendaryPurchases() {
    return validateLegendaryPurchaseCatalog(SKINS);
}

export function isSkinPurchased(id) {
    const skin = getSkin(id);
    const entity = getLegendaryPurchaseEntity(id);
    if (!skin || skin.unlockType !== 'premium' || !entity) return false;
    const state = loadCosmeticState();
    return state.purchasedSkins.includes(id);
}

export function purchasePremiumSkinLocalTest(id) {
    const skin = getSkin(id);
    const entity = getLegendaryPurchaseEntity(id);
    if (!skin || skin.unlockType !== 'premium' || skin.isPreviewSlot || !entity) return null;

    const state = loadCosmeticState();
    const purchasedSkins = Array.isArray(state.purchasedSkins) ? state.purchasedSkins : [];
    const alreadyPurchased = purchasedSkins.includes(id);

    if (!alreadyPurchased) {
        purchasedSkins.push(id);
    }

    state.purchasedSkins = purchasedSkins;

    // Keep premium unlocks separate, but also mirror into unlockedSkins for legacy UI/state safety.
    if (!state.unlockedSkins.includes(id)) {
        state.unlockedSkins.push(id);
    }

    saveCosmeticState(state);

    return {
        ...skin,
        productId: entity.productId,
        googlePlayProductId: entity.googlePlayProductId,
        steamProductId: entity.steamProductId,
        steamItemDefId: entity.steamItemDefId,
        priceUsd: entity.priceUsd,
        priceLabel: entity.priceLabel,
        purchaseEntity: entity,
        alreadyPurchased,
        localTestPurchase: true
    };
}


export function grantPremiumSkinEntitlement(id, options = {}) {
    const skin = getSkin(id);
    const entity = getLegendaryPurchaseEntity(id);
    if (!skin || skin.unlockType !== 'premium' || skin.isPreviewSlot || !entity) return null;

    const state = loadCosmeticState();
    const purchasedSkins = Array.isArray(state.purchasedSkins) ? state.purchasedSkins : [];
    const alreadyPurchased = purchasedSkins.includes(id);

    if (!alreadyPurchased) {
        purchasedSkins.push(id);
    }

    state.purchasedSkins = purchasedSkins;

    // Keep premium unlocks separate, but mirror into unlockedSkins so the existing UI/state works.
    if (!state.unlockedSkins.includes(id)) {
        state.unlockedSkins.push(id);
    }

    saveCosmeticState(state);

    return {
        ...skin,
        productId: entity.productId,
        googlePlayProductId: entity.googlePlayProductId,
        steamProductId: entity.steamProductId,
        steamItemDefId: entity.steamItemDefId,
        priceUsd: entity.priceUsd,
        priceLabel: entity.priceLabel,
        purchaseEntity: entity,
        alreadyPurchased,
        entitlementSource: options.source || 'platform',
        platform: options.platform || null,
        platformProductId: options.productId || null,
        transactionId: options.transactionId || null,
        orderId: options.orderId || null
    };
}

export function revokePremiumSkinEntitlement(id, options = {}) {
    const skin = getSkin(id);
    const entity = getLegendaryPurchaseEntity(id);
    if (!skin || skin.unlockType !== 'premium' || !entity) return null;

    const state = loadCosmeticState();
    const beforePurchased = Array.isArray(state.purchasedSkins) ? state.purchasedSkins : [];
    const beforeUnlocked = Array.isArray(state.unlockedSkins) ? state.unlockedSkins : [];

    state.purchasedSkins = beforePurchased.filter(skinId => skinId !== id);
    state.unlockedSkins = beforeUnlocked.filter(skinId => skinId !== id || SKINS[skinId]?.unlockType !== 'premium');

    if (state.selectedPlayerSkin === id) {
        state.selectedPlayerSkin = 'equipped_player_preview';
    }

    if (state.selectedSoldierSkin === id) {
        state.selectedSoldierSkin = 'soldier_soldier_denim_red';
    }

    saveCosmeticState(state);

    return {
        ...skin,
        productId: entity.productId,
        googlePlayProductId: entity.googlePlayProductId,
        steamProductId: entity.steamProductId,
        steamItemDefId: entity.steamItemDefId,
        purchaseEntity: entity,
        entitlementSource: options.source || 'platform_revoke',
        platform: options.platform || null,
        platformProductId: options.productId || null,
        transactionId: options.transactionId || null,
        orderId: options.orderId || null
    };
}

export function getSkinIdForProductId(productId) {
    const entity = getLegendaryPurchaseEntityByProductId(productId);
    return entity?.skinId || null;
}

export function restoreLocalTestPurchases() {
    const state = loadCosmeticState();
    let changed = false;

    (state.purchasedSkins || []).forEach(id => {
        if (SKINS[id]?.unlockType === 'premium' && getLegendaryPurchaseEntity(id) && !state.unlockedSkins.includes(id)) {
            state.unlockedSkins.push(id);
            changed = true;
        }
    });

    if (changed) saveCosmeticState(state);

    return (state.purchasedSkins || [])
        .map(id => SKINS[id])
        .filter(Boolean);
}

export const MINIGAME_REWARDS = {
    memory_match: null,
    parasite_maze: null
};

export function unlockMiniGameReward(miniGameId) {
    // Mini-games are not allowed to unlock Legendary/Premium Chigga Wear.
    // Keeping this export prevents older MemoryMatchScene imports from breaking.
    const rewardId = MINIGAME_REWARDS[miniGameId];
    if (!rewardId || !SKINS[rewardId]) return null;

    const reward = SKINS[rewardId];
    if (reward.unlockType === 'premium' || reward.rarity === 'legendary') return null;

    return unlockSkin(rewardId);
}

export function getUnlockRequirementText(skinOrId) {
    const skin = typeof skinOrId === 'string' ? getSkin(skinOrId) : skinOrId;
    if (!skin) return 'Unknown unlock requirement';

    const pass95ARequirement = PASS95A_BASE_UNLOCK_REQUIREMENTS?.[skin.id];
    if (pass95ARequirement?.text) return pass95ARequirement.text;

    switch (skin.unlockType) {
        case 'free':
            return 'Free starter cosmetic';
        case 'stage_clear':
            return `Beat Stage ${skin.unlockStage}`;
        case 'achievement':
            return ACHIEVEMENT_REQUIREMENTS[skin.achievementId] || 'Complete achievement';
        case 'premium': {
            const entity = getLegendaryPurchaseEntity(skin.id);
            return `Purchase Only - ${entity?.priceLabel || LEGENDARY_ITEM_PRICE_LABEL}`;
        }
        default:
            return 'Locked';
    }
}

function getFirstUnlockedSkinByType(type) {
    const free = getFreeSkinIds()
        .map(id => SKINS[id])
        .find(skin => skin && skin.type === type);

    if (free) return free;

    return Object.values(SKINS).find(skin => skin && skin.type === type) || null;
}

export function getEquippedPlayerSkin() {
    const state = loadCosmeticState();
    const selected = getSkin(state.selectedPlayerSkin);

    if (!selected || selected.type !== 'player' || !isSkinUnlocked(selected.id)) {
        return SKINS.equipped_player_preview || getFirstUnlockedSkinByType('player');
    }

    return selected;
}

export function getEquippedSoldierSkin() {
    const state = loadCosmeticState();
    const selected = getSkin(state.selectedSoldierSkin);

    if (!selected || selected.type !== 'soldier' || !isSkinUnlocked(selected.id)) {
        return SKINS.soldier_soldier_denim_red || getFirstUnlockedSkinByType('soldier');
    }

    return selected;
}

export function setEquippedPlayerSkin(id) {
    const skin = getSkin(id);
    const state = loadCosmeticState();

    if (!skin || skin.type !== 'player' || !isSkinUnlocked(skin.id)) return false;

    state.selectedPlayerSkin = skin.id;
    if (!state.unlockedSkins.includes(skin.id)) {
        state.unlockedSkins.push(skin.id);
    }

    saveCosmeticState(state);
    return true;
}

export function setEquippedSoldierSkin(id) {
    const skin = getSkin(id);
    const state = loadCosmeticState();

    if (!skin || skin.type !== 'soldier' || !isSkinUnlocked(skin.id)) return false;

    state.selectedSoldierSkin = skin.id;
    if (!state.unlockedSkins.includes(skin.id)) {
        state.unlockedSkins.push(skin.id);
    }

    saveCosmeticState(state);
    return true;
}

export function getRarityColor(rarity) {
    switch (rarity) {
        case 'common': return 0xffffff;
        case 'rare': return 0x33aaff;
        case 'epic': return 0xaa44ff;
        case 'legendary': return 0xffaa00;
        default: return 0xffffff;
    }
}
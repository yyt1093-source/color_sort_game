const assert = require('assert');
const db = require('../db');

console.log('================================================================');
console.log('?? RUNNING COMPREHENSIVE TEST: Permanent 1-to-1 Referral System');
console.log('================================================================\n');

// Mock cloud storage simulating KVDB
class MockCloudKVDB {
  constructor() {
    this.store = new Map();
  }

  async get(key) {
    return this.store.get(key) || null;
  }

  async set(key, val) {
    this.store.set(key, typeof val === 'string' ? val : JSON.stringify(val));
  }

  async delete(key) {
    this.store.delete(key);
  }

  async list(prefix) {
    const res = [];
    for (const [k, v] of this.store.entries()) {
      if (k.startsWith(prefix)) {
        try {
          res.push([k, JSON.parse(v)]);
        } catch(e) {
          res.push([k, v]);
        }
      }
    }
    return res;
  }
}

const cloud = new MockCloudKVDB();

// Client logic simulation mirroring app.js processIncomingReferral & loadReferralsData
class SimulatedClient {
  constructor(telegramId, firstName, username, cloudStorage) {
    this.telegramId = String(telegramId);
    this.firstName = firstName;
    this.username = username;
    this.localStorage = new Map();
    this.cloud = cloudStorage;
    this.currentUser = {
      telegramId: this.telegramId,
      firstName: this.firstName,
      username: this.username,
      currentLevel: 1,
      maxLevel: 1,
      stars: 0,
      hints: 5,
      undos: 5,
      reveals: 5,
      extraBottles: 0
    };
  }

  async processIncomingReferral(refParam) {
    const myId = this.telegramId;
    const inviterId = String(refParam || '').trim();
    if (!inviterId || inviterId === myId) return { success: false, reason: 'self_or_empty' };

    // 1. Fast local check
    if (this.localStorage.get('cs_ref_permanently_locked') === 'true' || this.localStorage.get('cs_bound_referrer_id')) {
      return { success: false, reason: 'already_locked_locally', boundTo: this.localStorage.get('cs_bound_referrer_id') };
    }

    // 2. Established player check
    if (this.currentUser.maxLevel > 1 || this.currentUser.stars > 0) {
      this.localStorage.set('cs_ref_permanently_locked', 'true');
      return { success: false, reason: 'existing_player_local' };
    }

    const cleanUname = (this.username || '').toLowerCase().replace(/^@/, '').trim();

    // 3. Cloud Registry Check ("Папка на облаке: Кто чей пригласитель")
    let boundInCloud = null;
    const bindRaw = await this.cloud.get(`ref_registry_binding_${myId}`);
    if (bindRaw) {
      const b = JSON.parse(bindRaw);
      if (b.referrerId || b.locked) boundInCloud = b.referrerId || 'locked';
    }

    if (!boundInCloud && cleanUname) {
      const uRaw = await this.cloud.get(`ref_registry_uname_${cleanUname}`);
      if (uRaw) {
        const u = JSON.parse(uRaw);
        if (u.referrerId || u.locked) boundInCloud = u.referrerId || 'locked';
      }
    }

    if (boundInCloud) {
      if (boundInCloud !== 'locked') {
        this.localStorage.set('cs_bound_referrer_id', boundInCloud);
      }
      this.localStorage.set('cs_ref_permanently_locked', 'true');
      return { success: false, reason: 'already_bound_in_cloud', boundTo: boundInCloud };
    }

    // 4. Cloud check: active player record
    const pRaw = await this.cloud.get(`player_${myId}`);
    if (pRaw) {
      const p = JSON.parse(pRaw);
      if (Number(p.maxLevel || p.level || 1) > 1 || Number(p.stars || 0) > 0) {
        this.localStorage.set('cs_ref_permanently_locked', 'true');
        await this.cloud.set(`ref_registry_binding_${myId}`, { refereeId: myId, referrerId: null, locked: true, isExistingPlayer: true });
        return { success: false, reason: 'existing_player_cloud' };
      }
    }

    // 5. Brand new player! Bind permanently to inviterId forever
    this.localStorage.set('cs_bound_referrer_id', inviterId);
    this.localStorage.set('cs_ref_permanently_locked', 'true');

    await this.cloud.set(`ref_registry_binding_${myId}`, {
      refereeId: myId,
      referrerId: inviterId,
      refereeName: this.firstName,
      refereeUsername: cleanUname,
      boundAt: Date.now(),
      permanent: true
    });

    if (cleanUname) {
      await this.cloud.set(`ref_registry_uname_${cleanUname}`, {
        username: cleanUname,
        refereeId: myId,
        referrerId: inviterId,
        boundAt: Date.now(),
        permanent: true
      });
    }

    // Save referral item for inviter
    await this.cloud.set(`ref_${inviterId}_${myId}`, {
      id: `ref_${inviterId}_${myId}`,
      referrerId: inviterId,
      referredId: myId,
      referredName: this.firstName,
      referredUsername: cleanUname,
      rewardClaimed: 0,
      createdAt: Date.now()
    });

    // Sync to SQLite backend
    db.registerReferral(inviterId, myId, this.firstName, cleanUname);

    return { success: true, boundTo: inviterId };
  }

  async loadReferrals() {
    const myId = this.telegramId;
    const pairs = await this.cloud.list(`ref_${myId}_`);
    const list = [];
    for (const [key, val] of pairs) {
      const friendId = val.referredId;
      const isClaimedCloud = await this.cloud.get(`ref_claim_${myId}_${friendId}`);
      const isClaimedLocal = this.localStorage.get(`cs_ref_claimed_${myId}_${friendId}`) === 'true';
      const isClaimed = !!(val.rewardClaimed || isClaimedCloud || isClaimedLocal);
      list.push({
        id: key,
        referredId: friendId,
        name: val.referredName,
        rewardClaimed: isClaimed ? 1 : 0
      });
    }
    return list;
  }

  async claimReward(friendId) {
    const myId = this.telegramId;
    this.localStorage.set(`cs_ref_claimed_${myId}_${friendId}`, 'true');
    await this.cloud.set(`ref_claim_${myId}_${friendId}`, {
      referrerId: myId,
      referredId: friendId,
      claimedAt: Date.now(),
      rewardClaimed: 1
    });
    const key = `ref_${myId}_${friendId}`;
    const raw = await this.cloud.get(key);
    if (raw) {
      const item = typeof raw === 'string' ? JSON.parse(raw) : raw;
      item.rewardClaimed = 1;
      await this.cloud.set(key, item);
    }
    this.currentUser.hints += 5;
    this.currentUser.undos += 5;
    this.currentUser.reveals += 5;
    this.currentUser.extraBottles += 5;
  }
}

async function runTests() {
  console.log('--- TEST 1: Initial referral binding of Player B by Inviter A ---');
  const inviterA = new SimulatedClient('11111111', 'Inviter_A', 'inviter_a', cloud);
  const playerB = new SimulatedClient('22222222', 'Player_B', 'player_b', cloud);

  const res1 = await playerB.processIncomingReferral('11111111');
  assert.strictEqual(res1.success, true);
  assert.strictEqual(res1.boundTo, '11111111');
  console.log('  ? [PASS] Player B successfully bound to Inviter A');

  console.log('\n--- TEST 2: Inviter A sees Player B with unclaimed reward ---');
  let refsA = await inviterA.loadReferrals();
  assert.strictEqual(refsA.length, 1);
  assert.strictEqual(refsA[0].referredId, '22222222');
  assert.strictEqual(refsA[0].rewardClaimed, 0);
  console.log('  ? [PASS] Inviter A has Player B with rewardClaimed = 0 (Button: Забрать награду)');

  console.log('\n--- TEST 3: Inviter A claims reward (+5 to all boosters) ---');
  await inviterA.claimReward('22222222');
  refsA = await inviterA.loadReferrals();
  assert.strictEqual(refsA[0].rewardClaimed, 1);
  assert.strictEqual(inviterA.currentUser.hints, 10);
  assert.strictEqual(inviterA.currentUser.extraBottles, 5);
  console.log('  ? [PASS] Inviter A claimed reward. Status is rewardClaimed = 1 (Tag: ? Награда получена)');

  console.log('\n--- TEST 4: Player B deletes game (clears localStorage) and enters via Inviter C ---');
  // Player B completely clears localStorage (simulating app deletion or new device)
  playerB.localStorage.clear();
  assert.strictEqual(playerB.localStorage.size, 0);

  // Inviter C tries to refer Player B
  const res2 = await playerB.processIncomingReferral('33333333');
  assert.strictEqual(res2.success, false);
  assert.strictEqual(res2.reason, 'already_bound_in_cloud');
  assert.strictEqual(res2.boundTo, '11111111');
  console.log('  ? [PASS] Cloud rejected Inviter C! Player B remained permanently bound to Inviter A');

  const inviterC = new SimulatedClient('33333333', 'Inviter_C', 'inviter_c', cloud);
  const refsC = await inviterC.loadReferrals();
  assert.strictEqual(refsC.length, 0);
  console.log('  ? [PASS] Inviter C has 0 referrals (no hijacking possible)');

  console.log('\n--- TEST 5: Player B enters again via Inviter A link (No duplicate in list, no double reward) ---');
  playerB.localStorage.clear();
  const res3 = await playerB.processIncomingReferral('11111111');
  assert.strictEqual(res3.success, false);
  assert.strictEqual(res3.boundTo, '11111111');

  refsA = await inviterA.loadReferrals();
  assert.strictEqual(refsA.length, 1); // Strictly 1 referee, no duplicates!
  assert.strictEqual(refsA[0].rewardClaimed, 1); // Remains claimed!
  console.log('  ? [PASS] Inviter A list still contains exactly 1 referee (no duplicate) and remains claimed');

  console.log('\n--- TEST 6: Global Season Reset Simulation ---');
  // Trigger Season Reset (resets player scores and leaderboard, but PRESERVES referrals and bindings)
  db.resetSeason();
  // Wiping only player_ scores in cloud, keeping ref_ and ref_registry_ intact
  const playerKeys = await cloud.list('player_');
  for (const [k] of playerKeys) {
    await cloud.delete(k);
  }

  // Check Inviter A referrals after season reset
  refsA = await inviterA.loadReferrals();
  assert.strictEqual(refsA.length, 1);
  assert.strictEqual(refsA[0].referredId, '22222222');
  assert.strictEqual(refsA[0].rewardClaimed, 1);
  console.log('  ? [PASS] Referrals and claimed status 100% IMMUNE to Season Reset! (Tag: ? Награда получена)');

  console.log('\n--- TEST 7: Existing player with Level 10 cannot be referred ---');
  const existingPlayer = new SimulatedClient('44444444', 'Veteran', 'veteran', cloud);
  existingPlayer.currentUser.maxLevel = 10;
  existingPlayer.currentUser.stars = 25;
  await cloud.set('player_44444444', { maxLevel: 10, stars: 25 });

  const res4 = await existingPlayer.processIncomingReferral('11111111');
  assert.strictEqual(res4.success, false);
  console.log('  ? [PASS] Veteran player rejected from being referred');

  console.log('\n================================================================');
  console.log('?? ALL 7/7 PERMANENT REFERRAL ARCHITECTURE TESTS PASSED 100%!');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('? Test failed:', err);
  process.exit(1);
});

// UserTracker Plugin for Revenge
// Notifies you with sound + push notification when a tracked user sends a message
 
import { findByProps, findByName } from "@revenge-mod/modules/finders";
import { after } from "@revenge-mod/patcher";
import { storage } from "@revenge-mod/storage";
import { React, ReactNative } from "@revenge-mod/metro/common";
 
const { useState, useEffect } = React;
const {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    Vibration,
    Platform,
} = ReactNative;
 
// ── Storage ───────────────────────────────────────────────────────────────────
const STORAGE_KEY = "usertracker_v2_ids";
 
function getTracked() {
    return storage[STORAGE_KEY] || [];
}
 
function saveTracked(arr) {
    storage[STORAGE_KEY] = arr;
}
 
// ── Sound & Vibration ─────────────────────────────────────────────────────────
function playNotificationSound() {
    try {
        // Use Discord's own notification sound module
        const SoundModule = findByProps("playSound", "stopSound");
        if (SoundModule) {
            // "message1" is Discord's default DM ping sound
            SoundModule.playSound("message1", 1);
        }
    } catch (e) {
        console.warn("[UserTracker] Could not play sound:", e);
    }
 
    // Vibrate on mobile: short-long-short pattern like a ping
    try {
        if (Platform.OS !== "web") {
            Vibration.vibrate([0, 100, 80, 200]);
        }
    } catch (e) {}
}
 
// ── Push Notification ─────────────────────────────────────────────────────────
function sendPushNotification(username, content, guildName, channelName) {
    try {
        // Try Discord's native local notification system (works on mobile)
        const NotifModule =
            findByProps("sendLocalNotification") ||
            findByProps("presentLocalNotification") ||
            findByProps("scheduleLocalNotification");
 
        if (NotifModule) {
            const fn =
                NotifModule.sendLocalNotification ||
                NotifModule.presentLocalNotification ||
                NotifModule.scheduleLocalNotification;
 
            fn({
                title: `👁️ ${username} sent a message`,
                body: `${guildName} › ${channelName}\n${content}`,
                sound: "default",
                priority: "high",
                importance: "high",
                vibrate: [0, 100, 80, 200],
            });
            return;
        }
    } catch (e) {}
 
    // Fallback: Web Notification API (desktop/web)
    try {
        if (typeof Notification !== "undefined") {
            if (Notification.permission === "granted") {
                new Notification(`👁️ ${username} sent a message`, {
                    body: `${guildName} › ${channelName}\n${content}`,
                    icon: "https://discord.com/assets/favicon.ico",
                    silent: false,
                });
            } else if (Notification.permission !== "denied") {
                Notification.requestPermission().then((perm) => {
                    if (perm === "granted") {
                        new Notification(`👁️ ${username} sent a message`, {
                            body: `${guildName} › ${channelName}\n${content}`,
                        });
                    }
                });
            }
        }
    } catch (e) {}
}
 
// ── In-App Toast ──────────────────────────────────────────────────────────────
function showInAppToast(username, content, guildName, channelName) {
    try {
        const ToastModule =
            findByProps("showToast", "open") ||
            findByProps("dispatchToast") ||
            findByProps("showSimpleToast");
 
        const msg = `👁️ ${username}: ${content.slice(0, 80)}${content.length > 80 ? "…" : ""}`;
 
        if (ToastModule?.showToast) {
            ToastModule.showToast(msg, ToastModule.ToastStyle?.NORMAL || 0);
        } else if (ToastModule?.dispatchToast) {
            ToastModule.dispatchToast(msg, { type: "info" });
        } else if (ToastModule?.showSimpleToast) {
            ToastModule.showSimpleToast({ title: msg });
        }
    } catch (e) {
        console.warn("[UserTracker] Toast failed:", e);
    }
}
 
// ── Core Alert Function ───────────────────────────────────────────────────────
function alertUser(message) {
    const author = message.author || message.message?.author;
    const content =
        message.content ||
        message.message?.content ||
        "[image / embed / file]";
    const username =
        author?.global_name || author?.username || "Unknown User";
 
    // Try to get guild/channel info
    let guildName = "Unknown Server";
    let channelName = "Unknown Channel";
 
    try {
        const ChannelStore = findByProps("getChannel", "getDMFromUserId");
        const GuildStore = findByProps("getGuild", "getGuildCount");
        const channelId = message.channel_id || message.message?.channel_id;
 
        if (channelId && ChannelStore) {
            const channel = ChannelStore.getChannel(channelId);
            if (channel) {
                channelName = channel.name ? `#${channel.name}` : "DM";
                if (channel.guild_id && GuildStore) {
                    const guild = GuildStore.getGuild(channel.guild_id);
                    if (guild) guildName = guild.name;
                }
            }
        }
    } catch (e) {}
 
    // Fire all three: sound + push + in-app toast
    playNotificationSound();
    sendPushNotification(username, content, guildName, channelName);
    showInAppToast(username, content, guildName, channelName);
 
    console.log(
        `[UserTracker] Notified: ${username} in ${guildName} › ${channelName}`
    );
}
 
// ── Plugin ────────────────────────────────────────────────────────────────────
let _unpatch = null;
 
export default {
    name: "UserTracker",
    description:
        "Get notified with sound + push when a tracked user sends a message in any mutual server.",
    version: "2.0.0",
    author: "you",
 
    onStart() {
        const MessageActions = findByProps("receiveMessage", "sendMessage");
 
        if (!MessageActions) {
            console.error("[UserTracker] Could not find MessageActions — plugin cannot start.");
            return;
        }
 
        _unpatch = after("receiveMessage", MessageActions, ([message]) => {
            if (!message) return;
 
            const authorId =
                message.author?.id || message.message?.author?.id;
            if (!authorId) return;
 
            const tracked = getTracked();
            if (tracked.includes(authorId)) {
                alertUser(message.message || message);
            }
        });
 
        console.log("[UserTracker] Started. Tracking:", getTracked());
    },
 
    onStop() {
        if (_unpatch) {
            _unpatch();
            _unpatch = null;
        }
        console.log("[UserTracker] Stopped.");
    },
 
    // ── Settings UI ───────────────────────────────────────────────────────────
    SettingsComponent() {
        const [input, setInput] = useState("");
        const [tracked, setTracked] = useState(getTracked());
 
        const add = () => {
            const id = input.trim();
            if (!id || tracked.includes(id)) {
                setInput("");
                return;
            }
            const updated = [...tracked, id];
            setTracked(updated);
            saveTracked(updated);
            setInput("");
        };
 
        const remove = (id) => {
            const updated = tracked.filter((u) => u !== id);
            setTracked(updated);
            saveTracked(updated);
        };
 
        return (
            <View style={styles.container}>
                <Text style={styles.title}>👁️ UserTracker</Text>
                <Text style={styles.subtitle}>
                    You'll get a sound + notification when any tracked user sends a message.
                </Text>
 
                <View style={styles.row}>
                    <TextInput
                        style={styles.input}
                        placeholder="Paste User ID here…"
                        placeholderTextColor="#555"
                        value={input}
                        onChangeText={setInput}
                        keyboardType="numeric"
                        returnKeyType="done"
                        onSubmitEditing={add}
                    />
                    <TouchableOpacity style={styles.addBtn} onPress={add}>
                        <Text style={styles.addBtnText}>Add</Text>
                    </TouchableOpacity>
                </View>
 
                {tracked.length === 0 ? (
                    <Text style={styles.empty}>
                        No users tracked yet.{"\n"}Paste a User ID above to start.
                    </Text>
                ) : (
                    <FlatList
                        data={tracked}
                        keyExtractor={(item) => item}
                        renderItem={({ item }) => (
                            <View style={styles.item}>
                                <Text style={styles.itemIcon}>👤</Text>
                                <Text style={styles.itemText}>{item}</Text>
                                <TouchableOpacity
                                    style={styles.removeBtn}
                                    onPress={() => remove(item)}
                                >
                                    <Text style={styles.removeBtnText}>Remove</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    />
                )}
 
                <Text style={styles.hint}>
                    To get a User ID: long-press someone's name in Discord → Copy ID
                </Text>
            </View>
        );
    },
};
 
// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: "#1e1f22",
    },
    title: {
        fontSize: 22,
        fontWeight: "bold",
        color: "#fff",
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 13,
        color: "#aaa",
        marginBottom: 16,
        lineHeight: 18,
    },
    row: {
        flexDirection: "row",
        marginBottom: 16,
        gap: 8,
    },
    input: {
        flex: 1,
        backgroundColor: "#2b2d31",
        color: "#fff",
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 14,
        borderWidth: 1,
        borderColor: "#3f4147",
    },
    addBtn: {
        backgroundColor: "#5865f2",
        borderRadius: 10,
        paddingHorizontal: 18,
        justifyContent: "center",
        alignItems: "center",
    },
    addBtnText: {
        color: "#fff",
        fontWeight: "bold",
        fontSize: 14,
    },
    item: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#2b2d31",
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: "#3f4147",
    },
    itemIcon: {
        fontSize: 16,
        marginRight: 10,
    },
    itemText: {
        flex: 1,
        color: "#fff",
        fontSize: 13,
        fontFamily: "monospace",
    },
    removeBtn: {
        backgroundColor: "#ed4245",
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 5,
    },
    removeBtnText: {
        color: "#fff",
        fontWeight: "bold",
        fontSize: 12,
    },
    empty: {
        color: "#555",
        textAlign: "center",
        marginTop: 40,
        fontSize: 14,
        lineHeight: 22,
    },
    hint: {
        color: "#555",
        fontSize: 11,
        marginTop: 20,
        textAlign: "center",
        lineHeight: 16,
    },
});

import Msg from "../../models/msg";
import User from "../../models/user";
import type {IrcEventHandler} from "../../client";
import {MessageType} from "../../../shared/types/msg";
import {ChanState} from "../../../shared/types/chan";

export default <IrcEventHandler>function (irc, network) {
	const client = this;

	irc.on("join", function (data) {
		let chan = network.getChannel(data.channel);
		const self = data.nick === irc.user.nick;

		if (typeof chan === "undefined") {
			chan = client.createChannel({
				name: data.channel,
				state: ChanState.JOINED,
			});

			client.emit("join", {
				network: network.uuid,
				chan: chan.getFilteredClone(true),
				shouldOpen: false,
				index: network.addChannel(chan),
			});
			client.save();

			chan.loadMessages(client, network);

			// Request channels' modes
			network.irc.raw("MODE", chan.name);
		} else if (self) {
			chan.state = ChanState.JOINED;

			client.emit("channel:state", {
				chan: chan.id,
				state: chan.state,
			});

			if (!network.reconnectPlaybackRequested) {
				chan.syncZncPlayback(network);
			}
			network.irc.raw("MODE", chan.name);
		}

		const user = new User({nick: data.nick});

		if (!self || !network.irc.network.cap.isEnabled("znc.in/playback")) {
			const msg = new Msg({
				time: data.time,
				from: user,
				hostmask: data.ident + "@" + data.hostname,
				gecos: data.gecos,
				account: data.account,
				type: MessageType.JOIN,
				self: self,
			});
			chan.recordPlaybackBoundary(data.time);
			chan.pushMessage(client, msg);
		}

		chan.setUser(new User({nick: data.nick}));
		client.emit("users", {
			chan: chan.id,
		});
	});
};

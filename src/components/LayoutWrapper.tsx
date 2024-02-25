'use client';

import Script from 'next/script';
import { Dispatch, SetStateAction, createContext, useState } from 'react';
import { io } from 'socket.io-client';

export interface AuthData {
	token: string;
	role: string;
	car_id: string;
}

interface CarData {
	speed: number;
	unit: string;
	latitude: number;
	longitude: number;
}

interface RSUData {
	rec_speed: number;
	latitude: number;
	longitude: number;
}

export const AuthContext = createContext<
	[AuthData, Dispatch<SetStateAction<AuthData>>]
>([{} as AuthData, () => {}]);
export const CarContext = createContext<CarData>({} as CarData);
export const RSUContext = createContext<RSUData>({} as RSUData);

export default function LayoutWrapper(props: { children: React.ReactNode }) {
	const [auth, setAuth] = useState<AuthData>({
		token: '',
		role: '',
		car_id: '',
	});
	const [car, setCar] = useState<CarData>({
		speed: 0.0,
		unit: 'km/h',
		latitude: 0.0,
		longitude: 0.0,
	});
	const [rsu, setRSU] = useState<RSUData>({
		rec_speed: 0.0,
		latitude: 0.0,
		longitude: 0.0,
	});

	const socket = io(`http://localhost:8002`);
	socket.on('connect', () => {
		console.log('Connect to OBU backend');
	});
	socket.on('car info', (message) => {
		setCar({
			speed: message['velocity'],
			unit: message['unit'],
			latitude: message['latitude'],
			longitude: message['longitude'],
		});
	});
	socket.on('rsu info', (message) => {
		setRSU({
			rec_speed: message['recommend_speed'],
			latitude: message['latitude'],
			longitude: message['longitude'],
		});
	});
	socket.on('disconnect', () => {
		console.log('Disconnected from OBU backend');
	});

	return (
		<>
			<Script
				src="https://muazkhan.com:9001/dist/RTCMultiConnection.min.js"
				strategy="beforeInteractive"
			/>
			<Script
				src="https://muazkhan.com:9001/socket.io/socket.io.js"
				strategy="beforeInteractive"
			/>
			<Script
				src="https://www.webrtc-experiment.com/RecordRTC.js"
				strategy="beforeInteractive"
			/>
			<AuthContext.Provider value={[auth, setAuth]}>
				<CarContext.Provider value={car}>
					<RSUContext.Provider value={rsu}>
						{props.children}
					</RSUContext.Provider>
				</CarContext.Provider>
			</AuthContext.Provider>
		</>
	);
}
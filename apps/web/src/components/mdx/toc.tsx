"use client";

import type { TOCItemInfo, TOCItemType } from "fumadocs-core/toc";
import type { ReactNode } from "react";
import {
	createContext,
	use,
	useEffect,
	useEffectEvent,
	useMemo,
	useState,
} from "react";

const ObserverContext = createContext<Observer | null>(null);

export function AnchorProvider({
	toc,
	single = false,
	options = { threshold: 0.9 },
	children,
}: {
	toc: TOCItemType[];
	single?: boolean;
	options?: IntersectionObserverInit;
	children?: ReactNode;
}) {
	const observer = useMemo(() => new Observer(), []);
	observer.single = single;

	useEffect(() => {
		observer.setItems(toc);
	}, [observer, toc]);

	useEffect(() => {
		observer.watch(options);
		return () => observer.unwatch();
	}, [observer, options]);

	return <ObserverContext value={observer}>{children}</ObserverContext>;
}

function useObserver() {
	const observer = use(ObserverContext);
	if (!observer)
		throw new Error("TOC hooks must be used under <AnchorProvider>.");
	return observer;
}

export function useTOCSelector<T>(select: (items: TOCItemInfo[]) => T) {
	const observer = useObserver();
	const [value, setValue] = useState<T>(() => select(observer.items));
	const listener = useEffectEvent(() => setValue(select(observer.items)));

	useEffect(() => observer.listen(listener), [observer]);
	return value;
}

export function useActiveAnchor() {
	return useTOCSelector((items) => {
		let current: TOCItemInfo | undefined;
		for (const item of items) {
			if (item.active && (!current || item.t > current.t)) current = item;
		}
		return current?.id;
	});
}

export function useItems() {
	return useTOCSelector((items) => items);
}

type ChangeListener = () => void;

class Observer {
	items: TOCItemInfo[] = [];
	single = false;
	private observer: IntersectionObserver | null = null;
	private listeners = new Set<ChangeListener>();

	listen(listener: ChangeListener) {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	setItems(toc: TOCItemType[]) {
		this.items = toc.flatMap((item) => {
			const id = item.url.startsWith("#") ? item.url.slice(1) : null;
			return id
				? [{ id, active: false, fallback: false, t: 0, original: item }]
				: [];
		});
		this.observeItems();
		this.notify();
	}

	watch(options?: IntersectionObserverInit) {
		if (this.observer) return;
		this.observer = new IntersectionObserver(
			(entries) => this.handleEntries(entries),
			options,
		);
		this.observeItems();
	}

	unwatch() {
		this.observer?.disconnect();
		this.observer = null;
	}

	private handleEntries(entries: IntersectionObserverEntry[]) {
		let activeCount = 0;
		this.items = this.items.map((item) => {
			const entry = entries.find(
				(candidate) => candidate.target.id === item.id,
			);
			const active = entry
				? entry.isIntersecting && (!this.single || activeCount === 0)
				: item.active;
			if (active) activeCount += 1;
			return active === item.active
				? item
				: { ...item, active, fallback: false, t: Date.now() };
		});
		this.notify();
	}

	private observeItems() {
		if (!this.observer) return;
		this.observer.disconnect();
		for (const item of this.items) {
			const element = document.getElementById(item.id);
			if (element) this.observer.observe(element);
		}
	}

	private notify() {
		for (const listener of this.listeners) listener();
	}
}

const MARK_PATHS = [
	"M10 128H0V107.149H10V128Z",
	"M110 11.0045H120V21.4299H130V31.8552H140V42.5701H149.722V95.276H140V107.149H130V74.7149H120V106.57H110V128H100V74.7149H90V106.57H80V128H70V106.57H60V74.7149H50V128H40V106.57H30V74.7149H20V107.149H10V95.276H0.277778V42.5701H10V31.8552H20V21.4299H30V11.0045H40V0H110V11.0045ZM30 42.8597H40V31.8552H30V42.8597ZM110 42.8597H120V31.8552H110V42.8597Z",
	"M150 128H140V107.149H150V128Z",
] as const;

const MARK_COLOR = "currentColor";

export function TentUiMark(props: React.ComponentProps<"svg">) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="150"
			height="128"
			viewBox="0 0 150 128"
			fill="none"
			aria-hidden
			{...props}
		>
			{MARK_PATHS.map((path, index) => (
				<path
					key={path}
					d={path}
					fill={MARK_COLOR}
					fillRule={index === 1 ? "evenodd" : undefined}
					clipRule={index === 1 ? "evenodd" : undefined}
				/>
			))}
		</svg>
	);
}

export function getTentUiMarkSVG() {
	return `<svg width="150" height="128" viewBox="0 0 150 128" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="${MARK_PATHS[0]}" fill="${MARK_COLOR}"/><path fill-rule="evenodd" clip-rule="evenodd" d="${MARK_PATHS[1]}" fill="${MARK_COLOR}"/><path d="${MARK_PATHS[2]}" fill="${MARK_COLOR}"/></svg>`;
}

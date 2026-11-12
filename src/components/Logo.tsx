import iconUrl from "../icon.svg";

export function Logo(props: {class?: string}) {
    return (
        <img
            src={iconUrl}
            alt="LaTeX Live"
            class={props.class}
            draggable={false}
        />
    );
}

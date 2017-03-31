export class Utils {

    static inElement(elementContainer: HTMLElement, element: HTMLElement, classNames: string[]): boolean {
        let hasClass = false;
        classNames.forEach(className => hasClass = hasClass || element.classList.contains(className));
        if (hasClass) {
            return true;
        } else {
            if (elementContainer !== element) {
                return this.inElement(elementContainer, element.parentNode as HTMLElement, classNames);
            } else {
                return false;
            }
        }
    }

    static addClass(element: HTMLElement | undefined, className: string, ...classNamesList: string[]) {
        classNamesList.push(className);
        if (element) {
            classNamesList.forEach(name => element.classList.add(name));
        }
    }

    static removeClass(element: HTMLElement | undefined, className: string) {
        if (element && element.classList) {
            element.classList.remove(className);
        }
    }

}

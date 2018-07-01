import { AfterViewInit, ComponentFactoryResolver, ComponentRef, ElementRef, Injector, TemplateRef, Type } from "@angular/core";
import { assertNever } from "@uifabric/utilities";
import { isReactNode } from "../renderer/react-node";
import { renderComponent, renderFunc, renderTemplate } from "../renderer/renderprop-helpers";

const blacklistedAttributesAsProps = [
  'class',
  'style'
];

const blacklistedAttributeMatchers = [
  /^_?ng-?.*/
];

export interface RenderComponentOptions<TContext extends object> {
  readonly componentType: Type<TContext>;
  readonly factoryResolver: ComponentFactoryResolver;
  readonly injector: Injector;
}

export type RenderInput<TContext extends object> =
  TemplateRef<TContext>
  | ((context: TContext) => HTMLElement)
  | ComponentRef<TContext>
  | RenderComponentOptions<TContext>;

export type JsxRenderFunc<TContext> = (context: TContext) => JSX.Element;

/**
 * Base class for Angular @Components wrapping React Components.
 * Simplifies some of the handling around passing down props and setting CSS on the host component.
 */
// NOTE: TProps is not used at the moment, but a preparation for a potential future change.
export abstract class ReactWrapperComponent<TProps extends {}> implements AfterViewInit {

  protected abstract reactNodeRef: ElementRef;

  constructor(protected readonly elementRef: ElementRef) { }

  ngAfterViewInit() {
    this._passAttributesAsProps();
    this._setHostDisplay();
  }

  protected initRenderInput<TContext extends object>(input: RenderInput<TContext>): JsxRenderFunc<TContext> | undefined {
    if (input === undefined) {
      return undefined;
    }

    if (input instanceof TemplateRef) {
      return (context: TContext) => renderTemplate(input, context);
    }

    if (input instanceof ComponentRef) {
      return (context: TContext) => renderComponent(input, context);
    }

    if (input instanceof Function) {
      return (context: TContext) => renderFunc(input, context);
    }

    if (typeof input === "object") {
      const { componentType, factoryResolver, injector } = input;
      const componentFactory = factoryResolver.resolveComponentFactory(componentType);
      const componentRef = componentFactory.create(injector);

      return (context: TContext) => renderComponent(componentRef, context);
    }

    assertNever(input);
  }

  private _passAttributesAsProps() {
    const hostAttributes = Array.from(
      (this.elementRef.nativeElement as HTMLElement).attributes
    );

    const whitelistedHostAttributes = hostAttributes.filter(attr => !this._isBlacklistedAttribute(attr));
    if (!whitelistedHostAttributes || whitelistedHostAttributes.length === 0) {
      return;
    }

    if (!this.reactNodeRef || !isReactNode(this.reactNodeRef.nativeElement)) {
      throw new Error('reactNodeRef must hold a reference to a ReactNode');
    }

    const props = whitelistedHostAttributes.reduce((acc, attr) => ({
      ...acc,
      [attr.name]: attr.value,
    }), {});

    this.reactNodeRef.nativeElement.setProperties(props);
  }

  private _setHostDisplay() {
    const nativeElement: HTMLElement = this.elementRef.nativeElement;

    // setTimeout since we want to wait until child elements are rendered
    setTimeout(() => {
      if (nativeElement.firstElementChild) {
        const rootChildDisplay = getComputedStyle(nativeElement.firstElementChild).display;
        nativeElement.style.display = rootChildDisplay;
      }
    });
  }

  private _isBlacklistedAttribute(attr: Attr) {
    if (blacklistedAttributesAsProps.includes(attr.name)) {
      return true;
    }

    return blacklistedAttributeMatchers.some(regExp => regExp.test(attr.name));
  }
}

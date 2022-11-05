# Laravel Goto Controller

- project have to be handled by **Composer**

## Features

- Controller

>- add method/action to clipboard if not found in controller ex."used through a trait"
>- supports controller definitions like
>     - `Something\PhotoController`
>     - `PhotoController`
>     - `PhotoController@index`

- Routes

>- to add project **APP_URL**, run `Laravel GoTo Controller` from the command palette.
>- popup will show both the route "uri & action"
>     - uri: will open the link in browser "if route is a **GET** && **APP_URL** was added"
>     - action: will open the controller file

### Notes

- controller have to be following the [laravel convention](https://laravel.com/docs/master/controllers)
- `Closure` routes wont have a link
- in order for controller link to redirect to the correct place
    - make sure the `terminal.integrated.scrollback` is set to big number ex.`100000` or even more if you have a very long list, otherwise you might get redirected to wrong controller.
    - if the controllers still doesnt show up in the popup, try restarting the editor

> #### Laravel v9+
>
> with v9 the route listing cmnd has changed, so now u have a new config to get around this, u can set the config per project so u have the same experience regardless of the fw version.
>
>```json
>// v8-
>"laravelGotoController.routeListCommand": "route:list --columns=uri,name,action,method --json",
>
>// v9+
>"laravelGotoController.routeListCommand": "route:list --json",
>```

<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the uploaded legacy HTML pages server-rendered through the shared content transformer, because this preserves their exact visual design while enabling language substitution.
- Model treatment details in one typed catalogue and render them through one dynamic route, because every card needs a distinct shareable page without duplicating layout logic.

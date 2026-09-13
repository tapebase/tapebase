-- Keep the reusable channel-verification queue focused on meaningful matches.
-- Video candidates remain intact and can still be reviewed independently.
delete from public.artist_youtube_channels
where status = 'candidate'
  and confidence_score < 0.4;

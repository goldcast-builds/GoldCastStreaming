const decide = async () => {
      const [, lists, licensed] = await Promise.all([
        useSession.getState().restore(),
        listLists().catch(() => [] as any[]),
        AsyncStorage.getItem("@goldcast_licensed"),
        new Promise((r) => setTimeout(r, 1800)),
      ]);
      if (cancelled) return;

      const { session, deviceMode } = useSession.getState();
      if (!deviceMode) {
        router.replace("/device");
        return;
      }

      // 1. Se já está logado na lista/servidor, entra direto nos canais
      if (session || lists.length > 0) {
        router.replace("/(tabs)");
        return;
      }

      // 2. Se ainda não ativou a licença com o código, vai para a Tela de Ativação
      if (licensed !== "true") {
        router.replace("/activate");
        return;
      }

      // 3. Licença ativa: vai para a Tela de Login IPTV
      router.replace("/login");
    };
